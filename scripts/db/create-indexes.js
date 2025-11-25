/* eslint-disable no-console */
const mongoose = require("mongoose")

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error("MONGODB_URI must be set")
}

// Helper to drop an index if it exists (by exact key spec OR by name)
async function dropIndexIfExists(db, collectionName, byKeyOrName) {
  const coll = db.collection(collectionName)
  const existing = await coll.indexes().catch(() => [])
  if (!Array.isArray(existing)) return

  // Match by name string or by the exact key document
  const target =
    typeof byKeyOrName === "string"
      ? existing.find((idx) => idx.name === byKeyOrName)
      : existing.find((idx) => JSON.stringify(idx.key) === JSON.stringify(byKeyOrName))

  if (target) {
    try {
      await coll.dropIndex(target.name)
      console.log(`Dropped index on ${collectionName}: ${target.name} (${JSON.stringify(target.key)})`)
    } catch (err) {
      // If it was already gone or a race condition happened, ignore
      if (err && err.codeName !== "IndexNotFound") {
        throw err
      }
    }
  }
}

const indexes = [
  { collection: "users", index: { createdAt: -1 } },
  { collection: "users", index: { email: 1 }, options: { unique: true } },
  { collection: "users", index: { status: 1, createdAt: -1 } },
  { collection: "transactions", index: { userId: 1, createdAt: -1 } },
  { collection: "transactions", index: { status: 1, createdAt: -1 } },
  { collection: "transactions", index: { userEmail: 1 } },
  { collection: "transactions", index: { createdAt: -1, _id: 1 } },

  // Read-paths for team rewards claim/history:
  { collection: "bonuspayouts", index: { receiverUserId: 1, status: 1, createdAt: -1 } },
  { collection: "bonuspayouts", index: { payerUserId: 1, type: 1, createdAt: -1 } },

  // ✅ Exact idempotency key per spec: (type, sourceTxId, receiverUserId)
  {
    collection: "bonuspayouts",
    index: { type: 1, sourceTxId: 1, receiverUserId: 1 },
    options: { unique: true, name: "uniq_type_source_receiver" },
  },

  { collection: "logs", index: { createdAt: -1 } },
  { collection: "clicks", index: { userId: 1, createdAt: -1 } },
  { collection: "cache", index: { key: 1 }, options: { unique: true } },
  { collection: "cache", index: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
]

async function ensureIndexes() {
  const connection = await mongoose.connect(uri)
  try {
    const db = connection.connection.db

    // --- One-time cleanup: drop the OLD unique index if present ---
    // Old order we want to migrate away from:
    const OLD_UNIQ_KEY = { sourceTxId: 1, type: 1, receiverUserId: 1 }
    await dropIndexIfExists(db, "bonuspayouts", OLD_UNIQ_KEY)
    // If it was created with an auto-generated name previously, try dropping by a likely name too:
    await dropIndexIfExists(db, "bonuspayouts", "sourceTxId_1_type_1_receiverUserId_1")

    // --- Create/ensure all indices ---
    for (const { collection, index, options } of indexes) {
      await db.collection(collection).createIndex(index, options)
      console.log(
        `Ensured index on ${collection}: ${JSON.stringify(index)}${options ? " " + JSON.stringify(options) : ""}`,
      )
    }
  } finally {
    await connection.disconnect()
  }
}

ensureIndexes().catch((error) => {
  console.error(error)
  process.exit(1)
})
