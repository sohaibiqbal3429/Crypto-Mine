import bcrypt from "bcryptjs"
import { createHash, randomBytes } from "crypto"
import mongoose from "mongoose"

export type InMemoryDocument = {
  _id: string
  createdAt: Date
  updatedAt: Date
  [key: string]: any
}

type Projection = string | Record<string, number>

type PopulateOption = { path: string; select?: string | undefined }

type SortSpec = Record<string, 1 | -1>

type QueryFilter = Record<string, any>

type UpdateSpec = Record<string, any>

const COLLECTION_RELATIONS: Record<string, Record<string, { collection: string }>> = {
  balances: { userId: { collection: "users" } },
  miningSessions: { userId: { collection: "users" } },
  notifications: { userId: { collection: "users" } },
  transactions: { userId: { collection: "users" } },
  walletAddresses: { userId: { collection: "users" } },
  giftBoxCycles: { winnerUserId: { collection: "users" } },
  giftBoxParticipants: {
    userId: { collection: "users" },
    cycleId: { collection: "giftBoxCycles" },
  },
}

const DEMO_PASSWORD = "admin123"

const globalState = globalThis as typeof globalThis & {
  __inMemoryDb?: InMemoryDatabase
}

class InMemoryQuery<T extends InMemoryDocument> implements PromiseLike<T[]> {
  private projection?: Projection
  private sortSpec?: SortSpec
  private skipValue?: number
  private limitValue?: number
  private leanMode = false
  private populateOptions: PopulateOption[] = []

  constructor(private readonly collection: InMemoryCollection<T>, private readonly filter: QueryFilter = {}) {}

  select(projection: Projection): this {
    this.projection = projection
    return this
  }

  sort(spec: SortSpec): this {
    this.sortSpec = spec
    return this
  }

  skip(value: number): this {
    this.skipValue = value
    return this
  }

  limit(value: number): this {
    this.limitValue = value
    return this
  }

  lean(): this {
    this.leanMode = true
    return this
  }

  populate(path: string, select?: string): this {
    this.populateOptions.push({ path, select })
    return this
  }

  async exec(): Promise<T[]> {
    let results = this.collection.filterDocuments(this.filter)

    if (this.sortSpec) {
      const entries = Object.entries(this.sortSpec)
      results = results.sort((a, b) => {
        for (const [field, direction] of entries) {
          const aValue = getValueAtPath(a, field)
          const bValue = getValueAtPath(b, field)
          if (aValue < bValue) return -1 * direction
          if (aValue > bValue) return 1 * direction
        }
        return 0
      })
    }

    if (typeof this.skipValue === "number" && this.skipValue > 0) {
      results = results.slice(this.skipValue)
    }

    if (typeof this.limitValue === "number") {
      results = results.slice(0, this.limitValue)
    }

    const processed = results.map((doc) => {
      let clone = deepClone(doc)

      if (this.populateOptions.length > 0) {
        for (const option of this.populateOptions) {
          clone = populateDocument(clone, this.collection, option)
        }
      }

      if (this.projection) {
        clone = applyProjection(clone, this.projection)
      }

      if (this.leanMode) {
        return clone as T
      }

      return Object.assign(createModelInstance(clone), clone)
    })

    return processed as T[]
  }

  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T[] | TResult> {
    return this.exec().catch(onrejected)
  }
}

class InMemoryCollection<T extends InMemoryDocument> {
  constructor(public readonly name: string, private readonly documents: T[]) {}

  filterDocuments(filter: QueryFilter): T[] {
    if (!filter || Object.keys(filter).length === 0) {
      return this.documents.map((doc) => deepClone(doc))
    }

    return this.documents.filter((doc) => matchesFilter(doc, filter)).map((doc) => deepClone(doc))
  }

  find(filter: QueryFilter = {}): InMemoryQuery<T> {
    return new InMemoryQuery<T>(this, filter)
  }

  async findOne(filter: QueryFilter = {}): Promise<T | null> {
    const [result] = this.filterDocuments(filter)
    return result ? (createModelInstance(result) as T) : null
  }

  async findById(id: string): Promise<T | null> {
    return this.findOne({ _id: id })
  }

  async countDocuments(filter: QueryFilter = {}): Promise<number> {
    return this.filterDocuments(filter).length
  }

  async aggregate(pipeline: Record<string, any>[]): Promise<any[]> {
    let results = this.documents.map((doc) => deepClone(doc))

    for (const stage of pipeline) {
      const operator = Object.keys(stage)[0] as keyof typeof stage
      const value = stage[operator]

      switch (operator) {
        case "$match":
          results = results.filter((doc) => matchesFilter(doc, value))
          break
        case "$group":
          results = applyGroupStage(results, value)
          break
        case "$sort":
          results = sortDocuments(results, value)
          break
        case "$limit":
          results = results.slice(0, Number(value) || 0)
          break
        case "$project":
          results = results.map((doc) => applyProjection(doc, value))
          break
        default:
          throw new Error(`Unsupported aggregation stage: ${String(operator)}`)
      }
    }

    return results
  }

  async create(doc: Partial<T>): Promise<T> {
    const now = new Date()
    const newDoc: T = {
      ...(deepClone(doc) as T),
      _id: doc._id ?? generateObjectId(),
      createdAt: doc.createdAt ?? now,
      updatedAt: doc.updatedAt ?? now,
    }

    this.documents.push(newDoc)
    return createModelInstance(deepClone(newDoc)) as T
  }

  async updateOne(filter: QueryFilter, update: UpdateSpec): Promise<{ acknowledged: boolean; modifiedCount: number }> {
    const doc = this.documents.find((item) => matchesFilter(item, filter))
    if (!doc) {
      return { acknowledged: true, modifiedCount: 0 }
    }

    applyUpdateOperators(doc, update)
    doc.updatedAt = new Date()
    return { acknowledged: true, modifiedCount: 1 }
  }

  async updateMany(filter: QueryFilter, update: UpdateSpec): Promise<{ acknowledged: boolean; modifiedCount: number }> {
    let modified = 0
    for (const doc of this.documents) {
      if (matchesFilter(doc, filter)) {
        applyUpdateOperators(doc, update)
        doc.updatedAt = new Date()
        modified += 1
      }
    }

    return { acknowledged: true, modifiedCount: modified }
  }

  async deleteOne(filter: QueryFilter): Promise<{ acknowledged: boolean; deletedCount: number }> {
    const index = this.documents.findIndex((doc) => matchesFilter(doc, filter))
    if (index === -1) {
      return { acknowledged: true, deletedCount: 0 }
    }

    this.documents.splice(index, 1)
    return { acknowledged: true, deletedCount: 1 }
  }

  async deleteMany(filter: QueryFilter = {}): Promise<{ acknowledged: boolean; deletedCount: number }> {
    let deleted = 0
    for (let index = this.documents.length - 1; index >= 0; index -= 1) {
      if (matchesFilter(this.documents[index], filter)) {
        this.documents.splice(index, 1)
        deleted += 1
      }
    }

    return { acknowledged: true, deletedCount: deleted }
  }
}

class InMemoryDatabase {
  private initialized = false
  private collections = new Map<string, InMemoryCollection<InMemoryDocument>>()

  async initialize() {
    if (this.initialized) return

    const users = createUsers()
    this.collections.set("users", new InMemoryCollection("users", users))
    this.collections.set("balances", new InMemoryCollection("balances", createBalances(users)))
    this.collections.set("miningSessions", new InMemoryCollection("miningSessions", createMiningSessions(users)))
    this.collections.set("settings", new InMemoryCollection("settings", createSettings()))
    this.collections.set("commissionRules", new InMemoryCollection("commissionRules", createCommissionRules()))
    const giftBoxSeed = createGiftBoxSeed(users)
    this.collections.set("giftBoxCycles", new InMemoryCollection("giftBoxCycles", giftBoxSeed.cycles))
    this.collections.set(
      "giftBoxParticipants",
      new InMemoryCollection("giftBoxParticipants", giftBoxSeed.participants),
    )
    this.collections.set(
      "transactions",
      new InMemoryCollection("transactions", createTransactions(users, giftBoxSeed)),
    )
    this.collections.set("notifications", new InMemoryCollection("notifications", createNotifications(users)))
    this.collections.set("walletAddresses", new InMemoryCollection("walletAddresses", createWalletAddresses(users)))
    this.collections.set("levelHistories", new InMemoryCollection("levelHistories", []))

    this.initialized = true
  }

  getCollection<T extends InMemoryDocument>(name: string): InMemoryCollection<T> {
    const collection = this.collections.get(name)
    if (!collection) {
      throw new Error(`Unknown in-memory collection: ${name}`)
    }

    return collection as InMemoryCollection<T>
  }
}

function getDatabase(): InMemoryDatabase {
  if (!globalState.__inMemoryDb) {
    globalState.__inMemoryDb = new InMemoryDatabase()
  }

  return globalState.__inMemoryDb
}

export async function initializeInMemoryDatabase() {
  const db = getDatabase()
  await db.initialize()
  registerMongooseModels(db)
}

function registerMongooseModels(db: InMemoryDatabase) {
  const collections = [
    { name: "User", collection: db.getCollection("users") },
    { name: "Balance", collection: db.getCollection("balances") },
    { name: "MiningSession", collection: db.getCollection("miningSessions") },
    { name: "Settings", collection: db.getCollection("settings") },
    { name: "CommissionRule", collection: db.getCollection("commissionRules") },
    { name: "GiftBoxCycle", collection: db.getCollection("giftBoxCycles") },
    { name: "GiftBoxParticipant", collection: db.getCollection("giftBoxParticipants") },
    { name: "Transaction", collection: db.getCollection("transactions") },
    { name: "Notification", collection: db.getCollection("notifications") },
    { name: "WalletAddress", collection: db.getCollection("walletAddresses") },
    { name: "LevelHistory", collection: db.getCollection("levelHistories") },
  ] as const

  for (const { name, collection } of collections) {
    ;(mongoose.models as Record<string, any>)[name] = createModelProxy(collection)
  }
}

function createModelProxy<T extends InMemoryDocument>(collection: InMemoryCollection<T>) {
  return {
    find: (filter: QueryFilter = {}) => collection.find(filter),
    findOne: (filter: QueryFilter = {}) => collection.findOne(filter),
    findById: (id: string) => collection.findById(id),
    countDocuments: (filter: QueryFilter = {}) => collection.countDocuments(filter),
    aggregate: (pipeline: Record<string, any>[]) => collection.aggregate(pipeline),
    create: (doc: Partial<T>) => collection.create(doc),
    updateOne: (filter: QueryFilter, update: UpdateSpec) => collection.updateOne(filter, update),
    updateMany: (filter: QueryFilter, update: UpdateSpec) => collection.updateMany(filter, update),
    deleteOne: (filter: QueryFilter) => collection.deleteOne(filter),
    deleteMany: (filter: QueryFilter = {}) => collection.deleteMany(filter),
    findByIdAndUpdate: async (id: string, update: UpdateSpec) => {
      await collection.updateOne({ _id: id }, update)
      return collection.findById(id)
    },
    findOneAndUpdate: async (filter: QueryFilter, update: UpdateSpec) => {
      await collection.updateOne(filter, update)
      return collection.findOne(filter)
    },
  }
}

function applyProjection<T extends Record<string, any>>(doc: T, projection: Projection): T {
  if (!projection) return doc

  const clone = deepClone(doc)

  if (typeof projection === "string") {
    const fields = projection
      .split(/\s+/)
      .filter(Boolean)
      .map((field) => field.trim())

    if (fields.every((field) => field.startsWith("-"))) {
      for (const field of fields) {
        const key = field.slice(1)
        removePath(clone, key)
      }
      return clone
    }

    const picked: Record<string, any> = { _id: clone._id }
    for (const field of fields) {
      const key = field.startsWith("-") ? field.slice(1) : field
      const value = getValueAtPath(clone, key)
      if (field.startsWith("-")) {
        removePath(picked, key)
      } else if (value !== undefined) {
        setValueAtPath(picked, key, value)
      }
    }
    return picked as T
  }

  const includeKeys = Object.entries(projection)
    .filter(([, value]) => value === 1)
    .map(([key]) => key)
  const excludeKeys = Object.entries(projection)
    .filter(([, value]) => value === 0)
    .map(([key]) => key)

  if (includeKeys.length > 0) {
    const picked: Record<string, any> = { _id: clone._id }
    for (const key of includeKeys) {
      const value = getValueAtPath(clone, key)
      if (value !== undefined) {
        setValueAtPath(picked, key, value)
      }
    }
    return picked as T
  }

  if (excludeKeys.length > 0) {
    for (const key of excludeKeys) {
      removePath(clone, key)
    }
  }

  return clone
}

function populateDocument<T extends Record<string, any>>(
  doc: T,
  collection: InMemoryCollection<InMemoryDocument>,
  option: PopulateOption,
): T {
  const relationConfig = COLLECTION_RELATIONS[collection.name]?.[option.path]
  if (!relationConfig) {
    return doc
  }

  const relatedCollection = getDatabase().getCollection(relationConfig.collection)
  const value = getValueAtPath(doc, option.path)

  if (!value) {
    return doc
  }

  const relatedDoc = relatedCollection.filterDocuments({ _id: value })[0]
  if (!relatedDoc) {
    return doc
  }

  let populated = deepClone(relatedDoc)
  if (option.select) {
    populated = applyProjection(populated, option.select)
  }

  setValueAtPath(doc, option.path, populated)
  return doc
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function toComparableDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  return null
}

function compareValues(
  actual: unknown,
  expected: unknown,
  comparator: (actual: number | string, expected: number | string) => boolean,
): boolean {
  if (isNumber(actual) && isNumber(expected)) {
    return comparator(actual, expected)
  }

  if (isString(actual) && isString(expected)) {
    return comparator(actual, expected)
  }

  const actualDate = actual instanceof Date ? actual : null
  const expectedDate = toComparableDate(expected)
  if (actualDate && expectedDate) {
    return comparator(actualDate.getTime(), expectedDate.getTime())
  }

  return false
}

function matchesFilter(doc: Record<string, any>, filter: QueryFilter): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or" && Array.isArray(expected)) {
      return expected.some((subFilter) => matchesFilter(doc, subFilter))
    }

    if (key === "$and" && Array.isArray(expected)) {
      return expected.every((subFilter) => matchesFilter(doc, subFilter))
    }

    const actual = getValueAtPath(doc, key)

    if (expected && typeof expected === "object" && !(expected instanceof Date) && !Array.isArray(expected)) {
      return Object.entries(expected).every(([operator, value]) => {
        switch (operator) {
          case "$gte":
            return compareValues(actual, value, (a, b) => a >= b)
          case "$gt":
            return compareValues(actual, value, (a, b) => a > b)
          case "$lte":
            return compareValues(actual, value, (a, b) => a <= b)
          case "$lt":
            return compareValues(actual, value, (a, b) => a < b)
          case "$in":
            return Array.isArray(value) && value.includes(actual)
          case "$nin":
            return Array.isArray(value) && !value.includes(actual)
          case "$ne":
            return actual !== value
          case "$eq":
            return actual === value
          case "$regex": {
            const regex = value instanceof RegExp ? value : new RegExp(String(value), (expected as any).$options || "")
            return typeof actual === "string" && regex.test(actual)
          }
          case "$exists":
            return (actual !== undefined && actual !== null) === Boolean(value)
          default:
            return matchesFilter(actual ?? {}, { [operator]: value })
        }
      })
    }

    return actual === expected
  })
}

function applyGroupStage(documents: any[], spec: Record<string, any>): any[] {
  const groups = new Map<string, { key: any; docs: any[] }>()

  for (const doc of documents) {
    const keyValue = resolveGroupKey(doc, spec._id)
    const keyString = JSON.stringify(keyValue)
    if (!groups.has(keyString)) {
      groups.set(keyString, { key: keyValue, docs: [] })
    }
    groups.get(keyString)!.docs.push(doc)
  }

  const results: any[] = []

  for (const { key, docs } of groups.values()) {
    const aggregated: Record<string, any> = { _id: key }

    for (const [field, accumulator] of Object.entries(spec)) {
      if (field === "_id") continue

      aggregated[field] = applyAccumulator(docs, accumulator)
    }

    results.push(aggregated)
  }

  return results
}

function resolveGroupKey(doc: any, keySpec: any): any {
  if (keySpec === null || keySpec === undefined) return null

  if (typeof keySpec === "string" && keySpec.startsWith("$")) {
    return getValueAtPath(doc, keySpec.slice(1))
  }

  if (typeof keySpec !== "object") {
    return keySpec
  }

  if (keySpec.$dateToString) {
    const dateValue = getValueAtPath(doc, keySpec.$dateToString.date.slice(1))
    if (!(dateValue instanceof Date)) return null
    const format = keySpec.$dateToString.format || "%Y-%m-%d"
    return formatDate(dateValue, format)
  }

  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(keySpec)) {
    result[key] = resolveGroupKey(doc, value)
  }
  return result
}

function applyAccumulator(docs: any[], accumulator: any): any {
  if (typeof accumulator !== "object" || accumulator === null) {
    return accumulator
  }

  if (accumulator.$sum !== undefined) {
    const sumSpec = accumulator.$sum
    if (typeof sumSpec === "number") return sumSpec * docs.length

    return docs.reduce((total, doc) => {
      const value = evaluateExpression(doc, sumSpec)
      return total + (typeof value === "number" ? value : 0)
    }, 0)
  }

  if (accumulator.$avg !== undefined) {
    const values = docs.map((doc) => evaluateExpression(doc, accumulator.$avg)).filter((value) => typeof value === "number")
    if (values.length === 0) return 0
    return values.reduce((total, value) => total + value, 0) / values.length
  }

  if (accumulator.$max !== undefined) {
    const values = docs.map((doc) => evaluateExpression(doc, accumulator.$max)).filter((value) => typeof value === "number")
    return values.length > 0 ? Math.max(...values) : null
  }

  if (accumulator.$min !== undefined) {
    const values = docs.map((doc) => evaluateExpression(doc, accumulator.$min)).filter((value) => typeof value === "number")
    return values.length > 0 ? Math.min(...values) : null
  }

  if (accumulator.$count !== undefined) {
    return docs.length
  }

  if (accumulator.$first !== undefined) {
    const first = docs[0]
    return evaluateExpression(first, accumulator.$first)
  }

  return null
}

function evaluateExpression(doc: any, expression: any): any {
  if (typeof expression === "number" || typeof expression === "string") {
    if (typeof expression === "string" && expression.startsWith("$")) {
      return getValueAtPath(doc, expression.slice(1))
    }
    return expression
  }

  if (typeof expression === "object" && expression !== null) {
    if (expression.$cond) {
      const [condition, ifTrue, ifFalse] = expression.$cond
      const conditionResult = evaluateCondition(doc, condition)
      return evaluateExpression(doc, conditionResult ? ifTrue : ifFalse)
    }
  }

  return null
}

function evaluateCondition(doc: any, condition: any): boolean {
  if (Array.isArray(condition) && condition.length === 3 && condition[0]?.$eq) {
    const [left, right] = condition[0].$eq
    return evaluateExpression(doc, left) === evaluateExpression(doc, right)
  }

  if (condition && typeof condition === "object" && condition.$eq) {
    const [left, right] = condition.$eq
    return evaluateExpression(doc, left) === evaluateExpression(doc, right)
  }

  return Boolean(evaluateExpression(doc, condition))
}

function sortDocuments(docs: any[], sortSpec: Record<string, number>): any[] {
  const entries = Object.entries(sortSpec)
  return [...docs].sort((a, b) => {
    for (const [field, direction] of entries) {
      const aValue = getValueAtPath(a, field)
      const bValue = getValueAtPath(b, field)
      if (aValue < bValue) return -1 * direction
      if (aValue > bValue) return 1 * direction
    }
    return 0
  })
}

function applyUpdateOperators(doc: Record<string, any>, update: UpdateSpec) {
  const operators = Object.keys(update)
  const hasOperator = operators.some((key) => key.startsWith("$"))

  if (!hasOperator) {
    Object.assign(doc, update)
    return
  }

  for (const [operator, value] of Object.entries(update)) {
    switch (operator) {
      case "$set":
        for (const [path, pathValue] of Object.entries(value ?? {})) {
          setValueAtPath(doc, path, pathValue)
        }
        break
      case "$inc":
        for (const [path, amount] of Object.entries(value ?? {})) {
          const current = Number(getValueAtPath(doc, path) ?? 0)
          setValueAtPath(doc, path, current + Number(amount))
        }
        break
      case "$push":
        for (const [path, item] of Object.entries(value ?? {})) {
          const current = getValueAtPath(doc, path)
          if (Array.isArray(current)) {
            current.push(item)
          } else {
            setValueAtPath(doc, path, [item])
          }
        }
        break
      case "$addToSet":
        for (const [path, item] of Object.entries(value ?? {})) {
          const current = getValueAtPath(doc, path)
          if (Array.isArray(current)) {
            if (!current.includes(item)) {
              current.push(item)
            }
          } else {
            setValueAtPath(doc, path, [item])
          }
        }
        break
      default:
        break
    }
  }
}

function getValueAtPath(target: any, path: string): any {
  if (!target) return undefined
  if (!path) return target

  return path.split(".").reduce((value, key) => {
    if (value === undefined || value === null) return undefined
    return value[key]
  }, target)
}

function setValueAtPath(target: any, path: string, value: any) {
  const segments = path.split(".")
  let current = target
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {}
    }
    current = current[key]
  }
  current[segments[segments.length - 1]] = value
}

function removePath(target: any, path: string) {
  const segments = path.split(".")
  let current = target
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]
    if (!current[key]) {
      return
    }
    current = current[key]
  }
  delete current[segments[segments.length - 1]]
}

function deepClone<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

function generateObjectId(): string {
  return randomBytes(12).toString("hex")
}

function createModelInstance<T extends Record<string, any>>(doc: T): T {
  return Object.assign(Object.create({}), doc)
}

function formatDate(date: Date, format: string): string {
  const pad = (value: number) => value.toString().padStart(2, "0")
  return format
    .replace("%Y", String(date.getUTCFullYear()))
    .replace("%m", pad(date.getUTCMonth() + 1))
    .replace("%d", pad(date.getUTCDate()))
}

function createUsers(): InMemoryDocument[] {
  const now = new Date()
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10)

  const adminId = generateObjectId()
  const userAId = generateObjectId()
  const userBId = generateObjectId()
  const userCId = generateObjectId()

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
      directActiveCount: 0,
      totalActiveDirects: 12,
      lastLevelUpAt: now,
      qualified: true,
      qualifiedAt: now,
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
      directActiveCount: 4,
      totalActiveDirects: 9,
      lastLevelUpAt: now,
      qualified: true,
      qualifiedAt: now,
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
      directActiveCount: 2,
      totalActiveDirects: 5,
      lastLevelUpAt: now,
      qualified: true,
      qualifiedAt: now,
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
      directActiveCount: 1,
      totalActiveDirects: 5,
      lastLevelUpAt: now,
      qualified: true,
      qualifiedAt: now,
      groups: { A: [], B: [], C: [], D: [] },
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function createBalances(users: InMemoryDocument[]): InMemoryDocument[] {
  const now = new Date()
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
  }))
}

function createMiningSessions(users: InMemoryDocument[]): InMemoryDocument[] {
  const now = new Date()
  return users.map((user, index) => ({
    _id: generateObjectId(),
    userId: user._id,
    nextEligibleAt: new Date(now.getTime() + (index === 0 ? 0 : 60 * 60 * 1000)),
    lastClickAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    earnedInCycle: 12 * (index + 1),
    totalClicks: 45 * (index + 1),
    createdAt: now,
    updatedAt: now,
  }))
}

function createSettings(): InMemoryDocument[] {
  const now = new Date()
  return [
    {
      _id: generateObjectId(),
      mining: { minPct: 1.5, maxPct: 1.5, roiCap: 3 },
      gating: { minDeposit: 30, minWithdraw: 30, joinNeedsReferral: true, activeMinDeposit: 80, capitalLockDays: 30 },
      joiningBonus: { threshold: 100, pct: 5 },
      commission: { baseDirectPct: 7, startAtDeposit: 50, highTierPct: 5, highTierStartAt: 100 },
      giftBox: {
        ticketPrice: 10,
        payoutPercentage: 90,
        cycleHours: 72,
        winnersCount: 1,
        autoDrawEnabled: true,
        refundPercentage: 0,
        depositAddress: "TRhSCE8igyVmMuuRqukZEQDkn3MuEAdvfw",
      },
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function createCommissionRules(): InMemoryDocument[] {
  const now = new Date()
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
      activeMin: 10,
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
      activeMin: 15,
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
      teamDailyPct: 0,
      teamRewardPct: 2,
      activeMin: 23,
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
      activeMin: 30,
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
  ]
}

type GiftBoxSeed = {
  cycles: InMemoryDocument[]
  participants: InMemoryDocument[]
  entryTransactions: InMemoryDocument[]
  payoutTransactions: InMemoryDocument[]
  rewardTransactions: InMemoryDocument[]
}

function hashUserId(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function createGiftBoxSeed(users: InMemoryDocument[]): GiftBoxSeed {
  const now = new Date()
  const cycleHours = 72
  const cycleMs = cycleHours * 60 * 60 * 1000
  const ticketPrice = 10
  const payoutPercentage = 90

  const currentCycleId = generateObjectId()
  const previousCycleId = generateObjectId()

  const currentStartTime = new Date(now.getTime() - 12 * 60 * 60 * 1000)
  const currentEndTime = new Date(currentStartTime.getTime() + cycleMs)
  const previousStartTime = new Date(currentStartTime.getTime() - cycleMs)
  const previousEndTime = currentStartTime

  const participants: InMemoryDocument[] = []
  const entryTransactions: InMemoryDocument[] = []
  const rewardTransactions: InMemoryDocument[] = []

  const previousParticipants = users.slice(0, Math.min(users.length, 5))
  const previousWinner = previousParticipants[0] ?? null

  previousParticipants.forEach((user, index) => {
    const joinedAt = new Date(previousStartTime.getTime() + index * 60 * 60 * 1000)
    participants.push({
      _id: generateObjectId(),
      userId: user._id,
      cycleId: previousCycleId,
      hashedUserId: hashUserId(String(user._id)),
      status: "active",
      depositId: null,
      createdAt: joinedAt,
      updatedAt: previousEndTime,
    })
    entryTransactions.push({
      _id: generateObjectId(),
      userId: user._id,
      type: "giftBoxEntry",
      amount: ticketPrice,
      status: "approved",
      meta: { cycleId: previousCycleId },
      createdAt: joinedAt,
      updatedAt: joinedAt,
    })
  })

  const currentParticipants = users.slice(0, Math.min(users.length, 3))
  currentParticipants.forEach((user, index) => {
    const joinedAt = new Date(currentStartTime.getTime() + index * 45 * 60 * 1000)
    participants.push({
      _id: generateObjectId(),
      userId: user._id,
      cycleId: currentCycleId,
      hashedUserId: hashUserId(String(user._id)),
      status: "active",
      depositId: null,
      createdAt: joinedAt,
      updatedAt: joinedAt,
    })
    entryTransactions.push({
      _id: generateObjectId(),
      userId: user._id,
      type: "giftBoxEntry",
      amount: ticketPrice,
      status: "approved",
      meta: { cycleId: currentCycleId },
      createdAt: joinedAt,
      updatedAt: joinedAt,
    })
  })

  const payoutTransactions: InMemoryDocument[] = []
  let payoutTxId: string | null = null

  if (previousWinner) {
    payoutTxId = generateObjectId()
    payoutTransactions.push({
      _id: payoutTxId,
      userId: previousWinner._id,
      type: "giftBoxPayout",
      amount: Math.round((ticketPrice * previousParticipants.length * payoutPercentage) / 100),
      status: "approved",
      meta: { cycleId: previousCycleId, note: "Gift box demo payout" },
      createdAt: previousEndTime,
      updatedAt: previousEndTime,
    })
  }

  const fairnessProof = {
    serverSeed: randomBytes(32).toString("hex"),
    clientSeed: randomBytes(16).toString("hex"),
    nonce: previousParticipants.length,
    hash: randomBytes(32).toString("hex"),
    winnerIndex: 0,
  }

  const cycles: InMemoryDocument[] = [
    {
      _id: previousCycleId,
      status: "completed",
      startTime: previousStartTime,
      endTime: previousEndTime,
      ticketPrice,
      payoutPercentage,
      totalParticipants: previousParticipants.length,
      winnerUserId: previousWinner?._id ?? null,
      payoutTxId,
      winnerSnapshot: previousWinner
        ? {
            userId: previousWinner._id,
            name: previousWinner.name,
            referralCode: previousWinner.referralCode,
            email: previousWinner.email,
            creditedAt: previousEndTime,
          }
        : null,
      fairnessProof,
      createdAt: previousStartTime,
      updatedAt: previousEndTime,
    },
    {
      _id: currentCycleId,
      status: "open",
      startTime: currentStartTime,
      endTime: currentEndTime,
      ticketPrice,
      payoutPercentage,
      totalParticipants: currentParticipants.length,
      winnerUserId: null,
      payoutTxId: null,
      winnerSnapshot: null,
      fairnessProof: null,
      createdAt: currentStartTime,
      updatedAt: now,
    },
  ]

  if (currentParticipants[0]) {
    rewardTransactions.push({
      _id: generateObjectId(),
      userId: currentParticipants[0]._id,
      type: "giftBoxReward",
      amount: 30,
      status: "approved",
      meta: {
        cycleId: currentCycleId,
        note: "Demo reward for approved deposit",
      },
      createdAt: currentStartTime,
      updatedAt: currentStartTime,
    })
  }

  return { cycles, participants, entryTransactions, payoutTransactions, rewardTransactions }
}

function createTransactions(users: InMemoryDocument[], giftBoxSeed?: GiftBoxSeed): InMemoryDocument[] {
  const now = new Date()
  const transactions: InMemoryDocument[] = []

  users.forEach((user, index) => {
    const baseAmount = 100 + index * 50

    transactions.push(
      {
        _id: generateObjectId(),
        userId: user._id,
        type: "deposit",
        amount: baseAmount,
        status: "approved",
        meta: { method: "USDT", reference: `DEP${index + 1}` },
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        _id: generateObjectId(),
        userId: user._id,
        type: "earn",
        amount: baseAmount * 0.12,
        status: "approved",
        meta: { source: "mining" },
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        _id: generateObjectId(),
        userId: user._id,
        type: "commission",
        amount: baseAmount * 0.05,
        status: "approved",
        meta: { source: "referral", fromUser: "ALICE01" },
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        _id: generateObjectId(),
        userId: user._id,
        type: "withdraw",
        amount: baseAmount * 0.3,
        status: index === 0 ? "pending" : "approved",
        meta: { method: "USDT", address: "TVxDemoAddress123" },
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
    )
  })

  if (giftBoxSeed?.entryTransactions?.length) {
    transactions.push(...giftBoxSeed.entryTransactions)
  }

  if (giftBoxSeed?.payoutTransactions?.length) {
    transactions.push(...giftBoxSeed.payoutTransactions)
  }

  if (giftBoxSeed?.rewardTransactions?.length) {
    transactions.push(...giftBoxSeed.rewardTransactions)
  }

  return transactions
}

function createNotifications(users: InMemoryDocument[]): InMemoryDocument[] {
  const now = new Date()
  const notifications: InMemoryDocument[] = []

  users.forEach((user, index) => {
    notifications.push(
      {
        _id: generateObjectId(),
        userId: user._id,
        title: "Welcome to Crypto Mine",
        body: "Your account is ready to start mining.",
        read: index === 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: generateObjectId(),
        userId: user._id,
        title: "Deposit Approved",
        body: "Your recent deposit has been approved and added to your balance.",
        read: false,
        createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
        updatedAt: now,
      },
    )
  })

  return notifications
}

function createWalletAddresses(users: InMemoryDocument[]): InMemoryDocument[] {
  const now = new Date()

  return users.map((user, index) => ({
    _id: generateObjectId(),
    userId: user._id,
    label: index === 0 ? "Primary Wallet" : `Wallet ${index + 1}`,
    address: `TVxDemoAddress${1000 + index}`,
    network: "TRC20",
    createdAt: now,
    updatedAt: now,
  }))
}

export function getDemoCredentials() {
  return { email: "admin@cryptomining.com", password: DEMO_PASSWORD }
}
