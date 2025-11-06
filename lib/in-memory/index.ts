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
type UpdateOptions = { upsert?: boolean }

// ---- Relations used by .populate() -----------------------------------------
const COLLECTION_RELATIONS: Record<string, Record<string, { collection: string }>> = {
  balances: { userId: { collection: "users" } },
  miningSessions: { userId: { collection: "users" } },
  notifications: { userId: { collection: "users" } },
  transactions: { userId: { collection: "users" } },
  walletAddresses: { userId: { collection: "users" } },
  bonuspayouts: {
    payerUserId: { collection: "users" },
    receiverUserId: { collection: "users" },
  },
  luckyDrawDeposits: {
    userId: { collection: "users" },
    decidedBy: { collection: "users" },
  },
  ledgerEntries: { userId: { collection: "users" } },
  luckyDrawRounds: {
    selectedDepositId: { collection: "luckyDrawDeposits" },
    selectedUserId: { collection: "users" },
  },
  teamDailyProfits: {
    memberId: { collection: "users" },
    "claimedBy.userId": { collection: "users" },
  },
  teamDailyClaims: {
    userId: { collection: "users" },
  },
}

// ---- Idempotency: composite key matcher (type, sourceTxId, receiverUserId) --
const IDEMPOTENCY_KEY_FIELDS = ["type", "sourceTxId", "receiverUserId"] as const
function hasIdempotencyKey(doc: Record<string, any>): boolean {
  return IDEMPOTENCY_KEY_FIELDS.every((k) => doc[k] !== undefined && doc[k] !== null)
}
function sameIdempotencyKey(a: Record<string, any>, b: Record<string, any>): boolean {
  return IDEMPOTENCY_KEY_FIELDS.every((k) => normalizeForComparison(a[k]) === normalizeForComparison(b[k]))
}

const DEMO_PASSWORD = "Coin4$"

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
          if (aValue === bValue) continue
          if (aValue === undefined || aValue === null) return 1 * direction // push empties to end for asc
          if (bValue === undefined || bValue === null) return -1 * direction
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

      return createModelInstance(this.collection, clone)
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
    return result ? (createModelInstance(this, result) as T) : null
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

  async create(doc: Partial<T> | Partial<T>[], _options?: unknown): Promise<T | T[]> {
    const createSingle = async (entry: Partial<T>): Promise<T> => {
      // --- Idempotency guard (type, sourceTxId, receiverUserId) -------------
      if (entry && typeof entry === "object" && hasIdempotencyKey(entry as Record<string, any>)) {
        const existing = this.documents.find((d) => sameIdempotencyKey(d, entry as Record<string, any>))
        if (existing) {
          return createModelInstance(this, deepClone(existing)) as T
        }
      }

      const now = new Date()
      const newDoc: T = {
        ...(deepClone(entry) as T),
        _id: (entry as any)?._id ?? generateObjectId(),
        createdAt: (entry as any)?.createdAt ?? now,
        updatedAt: (entry as any)?.updatedAt ?? now,
      }

      this.documents.push(newDoc)
      return createModelInstance(this, deepClone(newDoc)) as T
    }

    if (Array.isArray(doc)) {
      const created = await Promise.all(doc.map((item) => createSingle(item)))
      return created
    }

    return createSingle(doc)
  }

  async updateOne(
    filter: QueryFilter,
    update: UpdateSpec,
    options: UpdateOptions = {},
  ): Promise<{ acknowledged: boolean; modifiedCount: number; upsertedId?: string | null; upsertedCount: number }> {
    const doc = this.documents.find((item) => matchesFilter(item, filter))
    if (!doc) {
      if (!options.upsert) {
        return { acknowledged: true, modifiedCount: 0, upsertedCount: 0 }
      }

      const seed = extractEqualityFilter(filter)
      const now = new Date()
      const newDoc: T = {
        ...(deepClone(seed) as T),
        _id: generateObjectId(),
        createdAt: now,
        updatedAt: now,
      }

      // Apply update then run idempotency guard (so upsert respects it)
      applyUpdateOperators(newDoc as unknown as Record<string, any>, update, { isUpsert: true })
      // If idempotency key present & exists, don't insert duplicate
      if (hasIdempotencyKey(newDoc as any)) {
        const dup = this.documents.find((d) => sameIdempotencyKey(d, newDoc as any))
        if (dup) {
          return { acknowledged: true, modifiedCount: 0, upsertedId: dup._id, upsertedCount: 0 }
        }
      }

      this.documents.push(newDoc)
      return { acknowledged: true, modifiedCount: 1, upsertedId: newDoc._id, upsertedCount: 1 }
    }

    applyUpdateOperators(doc, update)
    doc.updatedAt = new Date()
    return { acknowledged: true, modifiedCount: 1, upsertedCount: 0 }
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

  saveDocument(doc: Partial<T>): T {
    const now = new Date()
    const normalized = deepClone({ ...(doc as Record<string, any>) }) as unknown as T & Record<string, any>

    if (!normalized._id) {
      normalized._id = generateObjectId() as any
    }

    if (!normalized.createdAt) {
      normalized.createdAt = now as any
    }

    // If saving a doc that would violate idempotency, overwrite target with existing
    if (hasIdempotencyKey(normalized)) {
      const dup = this.documents.find((d) => sameIdempotencyKey(d, normalized))
      if (dup && dup._id !== normalized._id) {
        // adopt the existing _id and treat as update
        normalized._id = dup._id
      }
    }

    normalized.updatedAt = now as any

    const existingIndex = this.documents.findIndex((entry) => entry._id === normalized._id)
    if (existingIndex === -1) {
      this.documents.push(normalized as T)
    } else {
      const existing = this.documents[existingIndex] as Record<string, any>
      normalized.createdAt = (existing.createdAt ?? normalized.createdAt ?? now) as any
      this.documents[existingIndex] = normalized as T
    }

    return deepClone(normalized) as T
  }

  // ---- snapshot helpers for transactions -----------------------------------
  _getRaw(): T[] {
    return this.documents
  }
  _setRaw(newDocs: T[]) {
    ;(this.documents as unknown as T[]) = newDocs
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
    this.collections.set(
      "transactions",
      new InMemoryCollection("transactions", createTransactions(users)),
    )
    this.collections.set("notifications", new InMemoryCollection("notifications", createNotifications(users)))
    this.collections.set("walletAddresses", new InMemoryCollection("walletAddresses", createWalletAddresses(users)))
    this.collections.set("levelHistories", new InMemoryCollection("levelHistories", []))
    this.collections.set("luckyDrawDeposits", new InMemoryCollection("luckyDrawDeposits", []))
    this.collections.set("ledgerEntries", new InMemoryCollection("ledgerEntries", []))
    this.collections.set("luckyDrawRounds", new InMemoryCollection("luckyDrawRounds", createLuckyDrawRounds(users)))
    this.collections.set("bonuspayouts", new InMemoryCollection("bonuspayouts", []))
    this.collections.set("teamDailyProfits", new InMemoryCollection("teamDailyProfits", []))
    this.collections.set("teamDailyClaims", new InMemoryCollection("teamDailyClaims", []))

    this.initialized = true
  }

  getCollection<T extends InMemoryDocument>(name: string): InMemoryCollection<T> {
    const collection = this.collections.get(name)
    if (!collection) {
      throw new Error(`Unknown in-memory collection: ${name}`)
    }

    return collection as InMemoryCollection<T>
  }

  // ---- transactional snapshots ---------------------------------------------
  _snapshot(): Map<string, InMemoryDocument[]> {
    const snap = new Map<string, InMemoryDocument[]>()
    for (const [name, coll] of this.collections.entries()) {
      // deep clone arrays and docs
      const cloned = coll._getRaw().map((d) => deepClone(d))
      snap.set(name, cloned)
    }
    return snap
  }

  _restore(snapshot: Map<string, InMemoryDocument[]>) {
    for (const [name, docs] of snapshot.entries()) {
      const coll = this.collections.get(name)
      if (coll) coll._setRaw(docs.map((d) => deepClone(d)))
    }
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
    { name: "Transaction", collection: db.getCollection("transactions") },
    { name: "Notification", collection: db.getCollection("notifications") },
    { name: "WalletAddress", collection: db.getCollection("walletAddresses") },
    { name: "LevelHistory", collection: db.getCollection("levelHistories") },
    { name: "LuckyDrawDeposit", collection: db.getCollection("luckyDrawDeposits") },
    { name: "LedgerEntry", collection: db.getCollection("ledgerEntries") },
    { name: "LuckyDrawRound", collection: db.getCollection("luckyDrawRounds") },
    { name: "BonusPayout", collection: db.getCollection("bonuspayouts") },
    { name: "TeamDailyProfit", collection: db.getCollection("teamDailyProfits") },
    { name: "TeamDailyClaim", collection: db.getCollection("teamDailyClaims") },
  ] as const

  for (const { name, collection } of collections) {
    ;(mongoose.models as Record<string, any>)[name] = createModelProxy(collection)
  }

  registerInMemorySessions(db)
}

class InMemoryClientSession {
  public inMemory = true
  private active = false
  private snapshot?: Map<string, InMemoryDocument[]>

  constructor(private readonly db: InMemoryDatabase) {}

  async startTransaction() {
    this.active = true
    // take snapshot for rollback
    this.snapshot = this.db._snapshot()
  }

  async commitTransaction() {
    this.active = false
    // discard snapshot
    this.snapshot = undefined
  }

  async abortTransaction() {
    if (this.active && this.snapshot) {
      this.db._restore(this.snapshot)
    }
    this.active = false
    this.snapshot = undefined
  }

  async withTransaction<T>(fn: (session: InMemoryClientSession) => Promise<T>): Promise<T> {
    await this.startTransaction()
    try {
      const result = await fn(this)
      await this.commitTransaction()
      return result
    } catch (error) {
      await this.abortTransaction().catch(() => null)
      throw error
    }
  }

  async endSession() {
    // ensure any pending snapshot is discarded
    this.active = false
    this.snapshot = undefined
  }
}

function registerInMemorySessions(db: InMemoryDatabase) {
  const factory = async () => new InMemoryClientSession(db)
  ;(mongoose as unknown as { startSession: typeof factory }).startSession = factory
  ;(mongoose.connection as unknown as { startSession: typeof factory }).startSession = factory
}

function createModelProxy<T extends InMemoryDocument>(collection: InMemoryCollection<T>) {
  return {
    find: (filter: QueryFilter = {}) => collection.find(filter),
    findOne: (filter: QueryFilter = {}) => collection.findOne(filter),
    findById: (id: string) => collection.findById(id),
    countDocuments: (filter: QueryFilter = {}) => collection.countDocuments(filter),
    aggregate: (pipeline: Record<string, any>[]) => collection.aggregate(pipeline),
    create: (doc: Partial<T>) => collection.create(doc),
    updateOne: (filter: QueryFilter, update: UpdateSpec, options?: UpdateOptions) =>
      collection.updateOne(filter, update, options),
    updateMany: (filter: QueryFilter, update: UpdateSpec) => collection.updateMany(filter, update),
    deleteOne: (filter: QueryFilter) => collection.deleteOne(filter),
    deleteMany: (filter: QueryFilter = {}) => collection.deleteMany(filter),
    findByIdAndUpdate: async (id: string, update: UpdateSpec) => {
      await collection.updateOne({ _id: id }, update)
      return collection.findById(id)
    },
    findOneAndUpdate: async (filter: QueryFilter, update: UpdateSpec, options?: UpdateOptions) => {
      await collection.updateOne(filter, update, options)
      return collection.findOne(filter)
    },
  }
}

function extractEqualityFilter(filter: QueryFilter): Record<string, any> {
  const seed: Record<string, any> = {}
  for (const [key, value] of Object.entries(filter ?? {})) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      !(value instanceof mongoose.Types.ObjectId)
    ) {
      continue
    }

    seed[key] = value
  }

  return seed
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

function normalizeForComparison(value: any): any {
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString()
  }

  if (value && typeof value === "object") {
    if (typeof (value as { toHexString?: () => string }).toHexString === "function") {
      return (value as { toHexString: () => string }).toHexString()
    }

    if (typeof value.toString === "function") {
      const stringValue = value.toString()
      if (stringValue && stringValue !== "[object Object]") {
        return stringValue
      }
    }
  }

  return value
}

function valuesEqual(actual: any, expected: any): boolean {
  if (Array.isArray(actual)) {
    return actual.some((item) => valuesEqual(item, expected))
  }

  if (Array.isArray(expected)) {
    return expected.some((item) => valuesEqual(actual, item))
  }

  const normalizedActual = normalizeForComparison(actual)
  const normalizedExpected = normalizeForComparison(expected)
  return normalizedActual === normalizedExpected
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
            return Array.isArray(value) && value.some((candidate) => valuesEqual(actual, candidate))
          case "$nin":
            return Array.isArray(value) && !value.some((candidate) => valuesEqual(actual, candidate))
          case "$ne":
            return !valuesEqual(actual, value)
          case "$eq":
            return valuesEqual(actual, value)
          case "$regex": {
            const regex = value instanceof RegExp ? value : new RegExp(String(value), (expected as any).$options || "")
            return typeof actual === "string" && regex.test(actual)
          }
          case "$options":
            return true
          case "$exists":
            return (actual !== undefined && actual !== null) === Boolean(value)
          default:
            return matchesFilter(actual ?? {}, { [operator]: value })
        }
      })
    }

    return valuesEqual(actual, expected)
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
      if (aValue === bValue) continue
      if (aValue === undefined || aValue === null) return 1 * direction
      if (bValue === undefined || bValue === null) return -1 * direction
      if (aValue < bValue) return -1 * direction
      if (aValue > bValue) return 1 * direction
    }
    return 0
  })
}

function applyUpdateOperators(
  doc: Record<string, any>,
  update: UpdateSpec,
  options: { isUpsert?: boolean } = {},
) {
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
      case "$setOnInsert":
        if (options.isUpsert) {
          for (const [path, pathValue] of Object.entries(value ?? {})) {
            if (getValueAtPath(doc, path) === undefined) {
              setValueAtPath(doc, path, pathValue)
            }
          }
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
 
