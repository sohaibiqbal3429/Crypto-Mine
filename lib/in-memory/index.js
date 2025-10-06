"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeInMemoryDatabase = initializeInMemoryDatabase;
exports.getDemoCredentials = getDemoCredentials;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const COLLECTION_RELATIONS = {
    balances: { userId: { collection: "users" } },
    miningSessions: { userId: { collection: "users" } },
    notifications: { userId: { collection: "users" } },
    transactions: { userId: { collection: "users" } },
    walletAddresses: { userId: { collection: "users" } },
};
const DEMO_PASSWORD = "admin123";
const globalState = globalThis;
class InMemoryQuery {
    constructor(collection, filter = {}) {
        this.collection = collection;
        this.filter = filter;
        this.leanMode = false;
        this.populateOptions = [];
    }
    select(projection) {
        this.projection = projection;
        return this;
    }
    sort(spec) {
        this.sortSpec = spec;
        return this;
    }
    skip(value) {
        this.skipValue = value;
        return this;
    }
    limit(value) {
        this.limitValue = value;
        return this;
    }
    lean() {
        this.leanMode = true;
        return this;
    }
    populate(path, select) {
        this.populateOptions.push({ path, select });
        return this;
    }
    async exec() {
        let results = this.collection.filterDocuments(this.filter);
        if (this.sortSpec) {
            const entries = Object.entries(this.sortSpec);
            results = results.sort((a, b) => {
                for (const [field, direction] of entries) {
                    const aValue = getValueAtPath(a, field);
                    const bValue = getValueAtPath(b, field);
                    if (aValue < bValue)
                        return -1 * direction;
                    if (aValue > bValue)
                        return 1 * direction;
                }
                return 0;
            });
        }
        if (typeof this.skipValue === "number" && this.skipValue > 0) {
            results = results.slice(this.skipValue);
        }
        if (typeof this.limitValue === "number") {
            results = results.slice(0, this.limitValue);
        }
        const processed = results.map((doc) => {
            let clone = deepClone(doc);
            if (this.populateOptions.length > 0) {
                for (const option of this.populateOptions) {
                    clone = populateDocument(clone, this.collection, option);
                }
            }
            if (this.projection) {
                clone = applyProjection(clone, this.projection);
            }
            if (this.leanMode) {
                return clone;
            }
            return Object.assign(createModelInstance(clone), clone);
        });
        return processed;
    }
    then(onfulfilled, onrejected) {
        return this.exec().then(onfulfilled, onrejected);
    }
    catch(onrejected) {
        return this.exec().catch(onrejected);
    }
}
class InMemoryCollection {
    constructor(name, documents) {
        this.name = name;
        this.documents = documents;
    }
    filterDocuments(filter) {
        if (!filter || Object.keys(filter).length === 0) {
            return this.documents.map((doc) => deepClone(doc));
        }
        return this.documents.filter((doc) => matchesFilter(doc, filter)).map((doc) => deepClone(doc));
    }
    find(filter = {}) {
        return new InMemoryQuery(this, filter);
    }
    async findOne(filter = {}) {
        const [result] = this.filterDocuments(filter);
        return result ? createModelInstance(result) : null;
    }
    async findById(id) {
        return this.findOne({ _id: id });
    }
    async countDocuments(filter = {}) {
        return this.filterDocuments(filter).length;
    }
    async aggregate(pipeline) {
        let results = this.documents.map((doc) => deepClone(doc));
        for (const stage of pipeline) {
            const operator = Object.keys(stage)[0];
            const value = stage[operator];
            switch (operator) {
                case "$match":
                    results = results.filter((doc) => matchesFilter(doc, value));
                    break;
                case "$group":
                    results = applyGroupStage(results, value);
                    break;
                case "$sort":
                    results = sortDocuments(results, value);
                    break;
                case "$limit":
                    results = results.slice(0, Number(value) || 0);
                    break;
                case "$project":
                    results = results.map((doc) => applyProjection(doc, value));
                    break;
                default:
                    throw new Error(`Unsupported aggregation stage: ${String(operator)}`);
            }
        }
        return results;
    }
    async create(doc) {
        const now = new Date();
        const newDoc = {
            ...deepClone(doc),
            _id: doc._id ?? generateObjectId(),
            createdAt: doc.createdAt ?? now,
            updatedAt: doc.updatedAt ?? now,
        };
        this.documents.push(newDoc);
        return createModelInstance(deepClone(newDoc));
    }
    async updateOne(filter, update) {
        const doc = this.documents.find((item) => matchesFilter(item, filter));
        if (!doc) {
            return { acknowledged: true, modifiedCount: 0 };
        }
        applyUpdateOperators(doc, update);
        doc.updatedAt = new Date();
        return { acknowledged: true, modifiedCount: 1 };
    }
    async updateMany(filter, update) {
        let modified = 0;
        for (const doc of this.documents) {
            if (matchesFilter(doc, filter)) {
                applyUpdateOperators(doc, update);
                doc.updatedAt = new Date();
                modified += 1;
            }
        }
        return { acknowledged: true, modifiedCount: modified };
    }
    async deleteOne(filter) {
        const index = this.documents.findIndex((doc) => matchesFilter(doc, filter));
        if (index === -1) {
            return { acknowledged: true, deletedCount: 0 };
        }
        this.documents.splice(index, 1);
        return { acknowledged: true, deletedCount: 1 };
    }
}
class InMemoryDatabase {
    constructor() {
        this.initialized = false;
        this.collections = new Map();
    }
    async initialize() {
        if (this.initialized)
            return;
        const users = createUsers();
        this.collections.set("users", new InMemoryCollection("users", users));
        this.collections.set("balances", new InMemoryCollection("balances", createBalances(users)));
        this.collections.set("miningSessions", new InMemoryCollection("miningSessions", createMiningSessions(users)));
        this.collections.set("settings", new InMemoryCollection("settings", createSettings()));
        this.collections.set("commissionRules", new InMemoryCollection("commissionRules", createCommissionRules()));
        this.collections.set("transactions", new InMemoryCollection("transactions", createTransactions(users)));
        this.collections.set("notifications", new InMemoryCollection("notifications", createNotifications(users)));
        this.collections.set("walletAddresses", new InMemoryCollection("walletAddresses", createWalletAddresses(users)));
        this.initialized = true;
    }
    getCollection(name) {
        const collection = this.collections.get(name);
        if (!collection) {
            throw new Error(`Unknown in-memory collection: ${name}`);
        }
        return collection;
    }
}
function getDatabase() {
    if (!globalState.__inMemoryDb) {
        globalState.__inMemoryDb = new InMemoryDatabase();
    }
    return globalState.__inMemoryDb;
}
async function initializeInMemoryDatabase() {
    const db = getDatabase();
    await db.initialize();
    registerMongooseModels(db);
}
function registerMongooseModels(db) {
    const collections = [
        { name: "User", collection: db.getCollection("users") },
        { name: "Balance", collection: db.getCollection("balances") },
        { name: "MiningSession", collection: db.getCollection("miningSessions") },
        { name: "Settings", collection: db.getCollection("settings") },
        { name: "CommissionRule", collection: db.getCollection("commissionRules") },
        { name: "Transaction", collection: db.getCollection("transactions") },
        { name: "Notification", collection: db.getCollection("notifications") },
        { name: "WalletAddress", collection: db.getCollection("walletAddresses") },
    ];
    for (const { name, collection } of collections) {
        ;
        mongoose_1.default.models[name] = createModelProxy(collection);
    }
}
function createModelProxy(collection) {
    return {
        find: (filter = {}) => collection.find(filter),
        findOne: (filter = {}) => collection.findOne(filter),
        findById: (id) => collection.findById(id),
        countDocuments: (filter = {}) => collection.countDocuments(filter),
        aggregate: (pipeline) => collection.aggregate(pipeline),
        create: (doc) => collection.create(doc),
        updateOne: (filter, update) => collection.updateOne(filter, update),
        updateMany: (filter, update) => collection.updateMany(filter, update),
        deleteOne: (filter) => collection.deleteOne(filter),
        findByIdAndUpdate: async (id, update) => {
            await collection.updateOne({ _id: id }, update);
            return collection.findById(id);
        },
        findOneAndUpdate: async (filter, update) => {
            await collection.updateOne(filter, update);
            return collection.findOne(filter);
        },
    };
}
function applyProjection(doc, projection) {
    if (!projection)
        return doc;
    const clone = deepClone(doc);
    if (typeof projection === "string") {
        const fields = projection
            .split(/\s+/)
            .filter(Boolean)
            .map((field) => field.trim());
        if (fields.every((field) => field.startsWith("-"))) {
            for (const field of fields) {
                const key = field.slice(1);
                removePath(clone, key);
            }
            return clone;
        }
        const picked = { _id: clone._id };
        for (const field of fields) {
            const key = field.startsWith("-") ? field.slice(1) : field;
            const value = getValueAtPath(clone, key);
            if (field.startsWith("-")) {
                removePath(picked, key);
            }
            else if (value !== undefined) {
                setValueAtPath(picked, key, value);
            }
        }
        return picked;
    }
    const includeKeys = Object.entries(projection)
        .filter(([, value]) => value === 1)
        .map(([key]) => key);
    const excludeKeys = Object.entries(projection)
        .filter(([, value]) => value === 0)
        .map(([key]) => key);
    if (includeKeys.length > 0) {
        const picked = { _id: clone._id };
        for (const key of includeKeys) {
            const value = getValueAtPath(clone, key);
            if (value !== undefined) {
                setValueAtPath(picked, key, value);
            }
        }
        return picked;
    }
    if (excludeKeys.length > 0) {
        for (const key of excludeKeys) {
            removePath(clone, key);
        }
    }
    return clone;
}
function populateDocument(doc, collection, option) {
    const relationConfig = COLLECTION_RELATIONS[collection.name]?.[option.path];
    if (!relationConfig) {
        return doc;
    }
    const relatedCollection = getDatabase().getCollection(relationConfig.collection);
    const value = getValueAtPath(doc, option.path);
    if (!value) {
        return doc;
    }
    const relatedDoc = relatedCollection.filterDocuments({ _id: value })[0];
    if (!relatedDoc) {
        return doc;
    }
    let populated = deepClone(relatedDoc);
    if (option.select) {
        populated = applyProjection(populated, option.select);
    }
    setValueAtPath(doc, option.path, populated);
    return doc;
}
function matchesFilter(doc, filter) {
    return Object.entries(filter).every(([key, expected]) => {
        if (key === "$or" && Array.isArray(expected)) {
            return expected.some((subFilter) => matchesFilter(doc, subFilter));
        }
        if (key === "$and" && Array.isArray(expected)) {
            return expected.every((subFilter) => matchesFilter(doc, subFilter));
        }
        const actual = getValueAtPath(doc, key);
        if (expected && typeof expected === "object" && !(expected instanceof Date) && !Array.isArray(expected)) {
            return Object.entries(expected).every(([operator, value]) => {
                switch (operator) {
                    case "$gte":
                        return actual >= value;
                    case "$gt":
                        return actual > value;
                    case "$lte":
                        return actual <= value;
                    case "$lt":
                        return actual < value;
                    case "$in":
                        return Array.isArray(value) && value.includes(actual);
                    case "$nin":
                        return Array.isArray(value) && !value.includes(actual);
                    case "$ne":
                        return actual !== value;
                    case "$eq":
                        return actual === value;
                    case "$regex": {
                        const regex = value instanceof RegExp ? value : new RegExp(String(value), expected.$options || "");
                        return typeof actual === "string" && regex.test(actual);
                    }
                    case "$exists":
                        return (actual !== undefined && actual !== null) === Boolean(value);
                    default:
                        return matchesFilter(actual ?? {}, { [operator]: value });
                }
            });
        }
        return actual === expected;
    });
}
function applyGroupStage(documents, spec) {
    const groups = new Map();
    for (const doc of documents) {
        const keyValue = resolveGroupKey(doc, spec._id);
        const keyString = JSON.stringify(keyValue);
        if (!groups.has(keyString)) {
            groups.set(keyString, { key: keyValue, docs: [] });
        }
        groups.get(keyString).docs.push(doc);
    }
    const results = [];
    for (const { key, docs } of groups.values()) {
        const aggregated = { _id: key };
        for (const [field, accumulator] of Object.entries(spec)) {
            if (field === "_id")
                continue;
            aggregated[field] = applyAccumulator(docs, accumulator);
        }
        results.push(aggregated);
    }
    return results;
}
function resolveGroupKey(doc, keySpec) {
    if (keySpec === null || keySpec === undefined)
        return null;
    if (typeof keySpec === "string" && keySpec.startsWith("$")) {
        return getValueAtPath(doc, keySpec.slice(1));
    }
    if (typeof keySpec !== "object") {
        return keySpec;
    }
    if (keySpec.$dateToString) {
        const dateValue = getValueAtPath(doc, keySpec.$dateToString.date.slice(1));
        if (!(dateValue instanceof Date))
            return null;
        const format = keySpec.$dateToString.format || "%Y-%m-%d";
        return formatDate(dateValue, format);
    }
    const result = {};
    for (const [key, value] of Object.entries(keySpec)) {
        result[key] = resolveGroupKey(doc, value);
    }
    return result;
}
function applyAccumulator(docs, accumulator) {
    if (typeof accumulator !== "object" || accumulator === null) {
        return accumulator;
    }
    if (accumulator.$sum !== undefined) {
        const sumSpec = accumulator.$sum;
        if (typeof sumSpec === "number")
            return sumSpec * docs.length;
        return docs.reduce((total, doc) => {
            const value = evaluateExpression(doc, sumSpec);
            return total + (typeof value === "number" ? value : 0);
        }, 0);
    }
    if (accumulator.$avg !== undefined) {
        const values = docs.map((doc) => evaluateExpression(doc, accumulator.$avg)).filter((value) => typeof value === "number");
        if (values.length === 0)
            return 0;
        return values.reduce((total, value) => total + value, 0) / values.length;
    }
    if (accumulator.$max !== undefined) {
        const values = docs.map((doc) => evaluateExpression(doc, accumulator.$max)).filter((value) => typeof value === "number");
        return values.length > 0 ? Math.max(...values) : null;
    }
    if (accumulator.$min !== undefined) {
        const values = docs.map((doc) => evaluateExpression(doc, accumulator.$min)).filter((value) => typeof value === "number");
        return values.length > 0 ? Math.min(...values) : null;
    }
    if (accumulator.$count !== undefined) {
        return docs.length;
    }
    if (accumulator.$first !== undefined) {
        const first = docs[0];
        return evaluateExpression(first, accumulator.$first);
    }
    return null;
}
function evaluateExpression(doc, expression) {
    if (typeof expression === "number" || typeof expression === "string") {
        if (typeof expression === "string" && expression.startsWith("$")) {
            return getValueAtPath(doc, expression.slice(1));
        }
        return expression;
    }
    if (typeof expression === "object" && expression !== null) {
        if (expression.$cond) {
            const [condition, ifTrue, ifFalse] = expression.$cond;
            const conditionResult = evaluateCondition(doc, condition);
            return evaluateExpression(doc, conditionResult ? ifTrue : ifFalse);
        }
    }
    return null;
}
function evaluateCondition(doc, condition) {
    if (Array.isArray(condition) && condition.length === 3 && condition[0]?.$eq) {
        const [left, right] = condition[0].$eq;
        return evaluateExpression(doc, left) === evaluateExpression(doc, right);
    }
    if (condition && typeof condition === "object" && condition.$eq) {
        const [left, right] = condition.$eq;
        return evaluateExpression(doc, left) === evaluateExpression(doc, right);
    }
    return Boolean(evaluateExpression(doc, condition));
}
function sortDocuments(docs, sortSpec) {
    const entries = Object.entries(sortSpec);
    return [...docs].sort((a, b) => {
        for (const [field, direction] of entries) {
            const aValue = getValueAtPath(a, field);
            const bValue = getValueAtPath(b, field);
            if (aValue < bValue)
                return -1 * direction;
            if (aValue > bValue)
                return 1 * direction;
        }
        return 0;
    });
}
function applyUpdateOperators(doc, update) {
    const operators = Object.keys(update);
    const hasOperator = operators.some((key) => key.startsWith("$"));
    if (!hasOperator) {
        Object.assign(doc, update);
        return;
    }
    for (const [operator, value] of Object.entries(update)) {
        switch (operator) {
            case "$set":
                for (const [path, pathValue] of Object.entries(value ?? {})) {
                    setValueAtPath(doc, path, pathValue);
                }
                break;
            case "$inc":
                for (const [path, amount] of Object.entries(value ?? {})) {
                    const current = Number(getValueAtPath(doc, path) ?? 0);
                    setValueAtPath(doc, path, current + Number(amount));
                }
                break;
            case "$push":
                for (const [path, item] of Object.entries(value ?? {})) {
                    const current = getValueAtPath(doc, path);
                    if (Array.isArray(current)) {
                        current.push(item);
                    }
                    else {
                        setValueAtPath(doc, path, [item]);
                    }
                }
                break;
            case "$addToSet":
                for (const [path, item] of Object.entries(value ?? {})) {
                    const current = getValueAtPath(doc, path);
                    if (Array.isArray(current)) {
                        if (!current.includes(item)) {
                            current.push(item);
                        }
                    }
                    else {
                        setValueAtPath(doc, path, [item]);
                    }
                }
                break;
            default:
                break;
        }
    }
}
function getValueAtPath(target, path) {
    if (!target)
        return undefined;
    if (!path)
        return target;
    return path.split(".").reduce((value, key) => {
        if (value === undefined || value === null)
            return undefined;
        return value[key];
    }, target);
}
function setValueAtPath(target, path, value) {
    const segments = path.split(".");
    let current = target;
    for (let index = 0; index < segments.length - 1; index += 1) {
        const key = segments[index];
        if (!current[key] || typeof current[key] !== "object") {
            current[key] = {};
        }
        current = current[key];
    }
    current[segments[segments.length - 1]] = value;
}
function removePath(target, path) {
    const segments = path.split(".");
    let current = target;
    for (let index = 0; index < segments.length - 1; index += 1) {
        const key = segments[index];
        if (!current[key]) {
            return;
        }
        current = current[key];
    }
    delete current[segments[segments.length - 1]];
}
function deepClone(value) {
    return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
function generateObjectId() {
    return (0, crypto_1.randomBytes)(12).toString("hex");
}
function createModelInstance(doc) {
    return Object.assign(Object.create({}), doc);
}
function formatDate(date, format) {
    const pad = (value) => value.toString().padStart(2, "0");
    return format
        .replace("%Y", String(date.getUTCFullYear()))
        .replace("%m", pad(date.getUTCMonth() + 1))
        .replace("%d", pad(date.getUTCDate()));
}
function createUsers() {
    const now = new Date();
    const passwordHash = bcryptjs_1.default.hashSync(DEMO_PASSWORD, 10);
    const adminId = generateObjectId();
    const userAId = generateObjectId();
    const userBId = generateObjectId();
    const userCId = generateObjectId();
    return [
        {
            _id: adminId,
            email: "admin@cryptomining.com",
            phone: "+15551234567",
            passwordHash,
            name: "Admin User",
            role: "admin",
            referralCode: "ADMIN001",
            referredBy: null,
            isActive: true,
            emailVerified: true,
            phoneVerified: true,
            depositTotal: 1200,
            withdrawTotal: 300,
            roiEarnedTotal: 450,
            level: 4,
            groups: { A: [userAId], B: [userBId], C: [userCId], D: [] },
            createdAt: now,
            updatedAt: now,
        },
        {
            _id: userAId,
            email: "alice@example.com",
            phone: "+15550000001",
            passwordHash,
            name: "Alice Miner",
            role: "user",
            referralCode: "ALICE01",
            referredBy: adminId,
            isActive: true,
            emailVerified: true,
            phoneVerified: false,
            depositTotal: 600,
            withdrawTotal: 100,
            roiEarnedTotal: 220,
            level: 2,
            groups: { A: [], B: [], C: [], D: [] },
            createdAt: now,
            updatedAt: now,
        },
        {
            _id: userBId,
            email: "bob@example.com",
            phone: "+15550000002",
            passwordHash,
            name: "Bob Staker",
            role: "user",
            referralCode: "BOB001",
            referredBy: adminId,
            isActive: true,
            emailVerified: false,
            phoneVerified: true,
            depositTotal: 350,
            withdrawTotal: 50,
            roiEarnedTotal: 120,
            level: 1,
            groups: { A: [], B: [], C: [], D: [] },
            createdAt: now,
            updatedAt: now,
        },
        {
            _id: userCId,
            email: "carol@example.com",
            phone: "+15550000003",
            passwordHash,
            name: "Carol Trader",
            role: "user",
            referralCode: "CAROL1",
            referredBy: adminId,
            isActive: true,
            emailVerified: true,
            phoneVerified: true,
            depositTotal: 420,
            withdrawTotal: 0,
            roiEarnedTotal: 140,
            level: 1,
            groups: { A: [], B: [], C: [], D: [] },
            createdAt: now,
            updatedAt: now,
        },
    ];
}
function createBalances(users) {
    const now = new Date();
    return users.map((user) => ({
        _id: generateObjectId(),
        userId: user._id,
        current: Math.max(user.depositTotal - user.withdrawTotal + user.roiEarnedTotal - 200, 0),
        totalBalance: user.depositTotal,
        totalEarning: user.roiEarnedTotal,
        lockedCapital: user.depositTotal * 0.4,
        lockedCapitalLots: [
            {
                amount: user.depositTotal * 0.4,
                lockStart: now,
                lockEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                released: false,
            },
        ],
        staked: user.depositTotal * 0.2,
        pendingWithdraw: 50,
        teamRewardsAvailable: 75,
        teamRewardsClaimed: 120,
        teamRewardsLastClaimedAt: now,
        createdAt: now,
        updatedAt: now,
    }));
}
function createMiningSessions(users) {
    const now = new Date();
    return users.map((user, index) => ({
        _id: generateObjectId(),
        userId: user._id,
        nextEligibleAt: new Date(now.getTime() + (index === 0 ? 0 : 60 * 60 * 1000)),
        lastClickAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        earnedInCycle: 12 * (index + 1),
        totalClicks: 45 * (index + 1),
        createdAt: now,
        updatedAt: now,
    }));
}
function createSettings() {
    const now = new Date();
    return [
        {
            _id: generateObjectId(),
            mining: { minPct: 2.5, maxPct: 3.5, roiCap: 3 },
            gating: { minDeposit: 30, minWithdraw: 30, joinNeedsReferral: true, activeMinDeposit: 80, capitalLockDays: 30 },
            joiningBonus: { threshold: 100, pct: 5 },
            commission: { baseDirectPct: 7, startAtDeposit: 50, highTierPct: 5, highTierStartAt: 100 },
            createdAt: now,
            updatedAt: now,
        },
    ];
}
function createCommissionRules() {
    const now = new Date();
    return [
        {
          _id: generateObjectId(),
          level: 1,
          directPct: 7,
          teamDailyPct: 1,
          teamRewardPct: 0,
          activeMin: 5,
          teamOverrides: [
            {
              team: "A",
              depth: 1,
              pct: 1,
              kind: "daily_override",
              payout: "commission",
              appliesTo: "profit",
            },
          ],
          monthlyBonuses: [],
          monthlyTargets: { directSale: 0, bonus: 0 },
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: generateObjectId(),
          level: 2,
          directPct: 8,
          teamDailyPct: 1,
          teamRewardPct: 0,
          activeMin: 15,
          teamOverrides: [
            {
              team: "A",
              depth: 1,
              pct: 1,
              kind: "daily_override",
              payout: "commission",
              appliesTo: "profit",
            },
            {
              team: "B",
              depth: 2,
              pct: 1,
              kind: "daily_override",
              payout: "commission",
              appliesTo: "profit",
            },
            {
              team: "C",
              depth: 3,
              pct: 1,
              kind: "daily_override",
              payout: "commission",
              appliesTo: "profit",
            },
          ],
          monthlyBonuses: [],
          monthlyTargets: { directSale: 0, bonus: 0 },
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: generateObjectId(),
          level: 3,
          directPct: 8,
          teamDailyPct: 8,
          teamRewardPct: 2,
          activeMin: 30,
          teamOverrides: [
            {
              team: "A",
              depth: 1,
              pct: 8,
              kind: "team_commission",
              payout: "commission",
              appliesTo: "profit",
            },
            {
              team: "B",
              depth: 2,
              pct: 8,
              kind: "team_commission",
              payout: "commission",
              appliesTo: "profit",
            },
            {
              team: "C",
              depth: 3,
              pct: 8,
              kind: "team_commission",
              payout: "commission",
              appliesTo: "profit",
            },
            {
              team: "D",
              depth: 4,
              pct: 8,
              kind: "team_commission",
              payout: "commission",
              appliesTo: "profit",
            },
            {
              team: "A",
              depth: 1,
              pct: 2,
              kind: "team_reward",
              payout: "reward",
              appliesTo: "profit",
            },
            {
              team: "B",
              depth: 2,
              pct: 2,
              kind: "team_reward",
              payout: "reward",
              appliesTo: "profit",
            },
            {
              team: "C",
              depth: 3,
              pct: 2,
              kind: "team_reward",
              payout: "reward",
              appliesTo: "profit",
            },
            {
              team: "D",
              depth: 4,
              pct: 2,
              kind: "team_reward",
              payout: "reward",
              appliesTo: "profit",
            },
          ],
          monthlyBonuses: [],
          monthlyTargets: { directSale: 0, bonus: 0 },
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: generateObjectId(),
          level: 4,
          directPct: 9,
          teamDailyPct: 2,
          teamRewardPct: 0,
          activeMin: 53,
          teamOverrides: [
            {
              team: "A",
              depth: 1,
              pct: 2,
              kind: "team_commission",
              payout: "commission",
              appliesTo: "profit",
            },
            {
              team: "B",
              depth: 2,
              pct: 2,
              kind: "team_commission",
              payout: "commission",
              appliesTo: "profit",
            },
            {
              team: "C",
              depth: 3,
              pct: 2,
              kind: "team_commission",
              payout: "commission",
              appliesTo: "profit",
            },
            {
              team: "D",
              depth: 4,
              pct: 2,
              kind: "team_commission",
              payout: "commission",
              appliesTo: "profit",
            },
          ],
          monthlyBonuses: [
            { threshold: 2200, amount: 200, type: "bonus", label: "Monthly Bonus" },
          ],
          monthlyTargets: { directSale: 2200, bonus: 200 },
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: generateObjectId(),
          level: 5,
          directPct: 10,
          teamDailyPct: 0,
          teamRewardPct: 2,
          activeMin: 83,
          teamOverrides: [
            {
              team: "A",
              depth: 1,
              pct: 2,
              kind: "team_reward",
              payout: "reward",
              appliesTo: "profit",
            },
            {
              team: "B",
              depth: 2,
              pct: 2,
              kind: "team_reward",
              payout: "reward",
              appliesTo: "profit",
            },
            {
              team: "C",
              depth: 3,
              pct: 2,
              kind: "team_reward",
              payout: "reward",
              appliesTo: "profit",
            },
            {
              team: "D",
              depth: 4,
              pct: 2,
              kind: "team_reward",
              payout: "reward",
              appliesTo: "profit",
            },
          ],
          monthlyBonuses: [
            { threshold: 4500, amount: 400, type: "salary", label: "Monthly Salary" },
          ],
          monthlyTargets: { directSale: 4500, bonus: 0, salary: 400 },
          createdAt: now,
          updatedAt: now,
        },
    ];
}
function createTransactions(users) {
    const now = new Date();
    const transactions = [];
    users.forEach((user, index) => {
        const baseAmount = 100 + index * 50;
        transactions.push({
            _id: generateObjectId(),
            userId: user._id,
            type: "deposit",
            amount: baseAmount,
            status: "approved",
            meta: { method: "USDT", reference: `DEP${index + 1}` },
            createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
            updatedAt: now,
        }, {
            _id: generateObjectId(),
            userId: user._id,
            type: "earn",
            amount: baseAmount * 0.12,
            status: "approved",
            meta: { source: "mining" },
            createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            updatedAt: now,
        }, {
            _id: generateObjectId(),
            userId: user._id,
            type: "commission",
            amount: baseAmount * 0.05,
            status: "approved",
            meta: { source: "referral", fromUser: "ALICE01" },
            createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            updatedAt: now,
        }, {
            _id: generateObjectId(),
            userId: user._id,
            type: "withdraw",
            amount: baseAmount * 0.3,
            status: index === 0 ? "pending" : "approved",
            meta: { method: "USDT", address: "TVxDemoAddress123" },
            createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            updatedAt: now,
        });
    });
    return transactions;
}
function createNotifications(users) {
    const now = new Date();
    const notifications = [];
    users.forEach((user, index) => {
        notifications.push({
            _id: generateObjectId(),
            userId: user._id,
            title: "Welcome to Crypto Mine",
            body: "Your account is ready to start mining.",
            read: index === 0,
            createdAt: now,
            updatedAt: now,
        }, {
            _id: generateObjectId(),
            userId: user._id,
            title: "Deposit Approved",
            body: "Your recent deposit has been approved and added to your balance.",
            read: false,
            createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
            updatedAt: now,
        });
    });
    return notifications;
}
function createWalletAddresses(users) {
    const now = new Date();
    return users.map((user, index) => ({
        _id: generateObjectId(),
        userId: user._id,
        label: index === 0 ? "Primary Wallet" : `Wallet ${index + 1}`,
        address: `TVxDemoAddress${1000 + index}`,
        network: "TRC20",
        createdAt: now,
        updatedAt: now,
    }));
}
function getDemoCredentials() {
    return { email: "admin@cryptomining.com", password: DEMO_PASSWORD };
}
