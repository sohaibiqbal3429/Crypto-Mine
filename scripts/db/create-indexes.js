/* eslint-disable no-console */
const mongoose = require("mongoose")

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error("MONGODB_URI must be set")
}

const indexes = [
  { collection: "users", index: { createdAt: -1 } },
  { collection: "users", index: { email: 1 }, options: { unique: true } },
  { collection: "users", index: { status: 1, createdAt: -1 } },
  { collection: "transactions", index: { userId: 1, createdAt: -1 } },
  { collection: "transactions", index: { status: 1, createdAt: -1 } },
  { collection: "transactions", index: { userEmail: 1 } },
  { collection: "transactions", index: { createdAt: -1, _id: 1 } },
  { collection: "bonuspayouts", index: { receiverUserId: 1, status: 1, createdAt: -1 } },
  { collection: "bonuspayouts", index: { payerUserId: 1, type: 1, createdAt: -1 } },
  {
    collection: "bonuspayouts",
    index: { sourceTxId: 1, type: 1, receiverUserId: 1 },
    options: { unique: true },
  },
  { collection: "logs", index: { createdAt: -1 } },
  { collection: "clicks", index: { userId: 1, createdAt: -1 } },
  { collection: "cache", index: { key: 1 }, options: { unique: true } },
  { collection: "cache", index: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
]

async function ensureIndexes() {
  const connection = await mongoose.connect(uri)
  try {
    for (const { collection, index, options } of indexes) {
      await connection.connection.db.collection(collection).createIndex(index, options)
      console.log(`Created index on ${collection}: ${JSON.stringify(index)}`)
    }
  } finally {
    await connection.disconnect()
  }
}

ensureIndexes().catch((error) => {
  console.error(error)
  process.exit(1)
})
