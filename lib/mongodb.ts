import mongoose from "mongoose"

import { connectMongo } from "./db"
import { initializeInMemoryDatabase } from "./in-memory"
import { resolveMongoUri } from "./mongo-uri"

type MongooseCache = {
  conn: any
  promise: Promise<typeof mongoose> | null
}

type GlobalWithMongoose = typeof globalThis & {
  mongoose?: MongooseCache
  __inMemoryDbInitialized?: boolean
}

const globalWithMongoose = globalThis as GlobalWithMongoose

const cached: MongooseCache = globalWithMongoose.mongoose || { conn: null, promise: null }
if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = cached
}

async function ensureInMemoryConnection() {
  if (!globalWithMongoose.__inMemoryDbInitialized) {
    await initializeInMemoryDatabase()
    globalWithMongoose.__inMemoryDbInitialized = true
    console.warn(
      "[database] Running in demo mode with an in-memory data set. Set MONGODB_URI to connect to a persistent database.",
    )
  }

  if (!cached.conn) {
    cached.conn = { inMemory: true }
  }

  return cached.conn
}

export default async function dbConnect() {
  const seedFlag = process.env.SEED_IN_MEMORY === "true"
  const allowFallback = seedFlag || process.env.ALLOW_DB_FALLBACK === "true"
  const uri = resolveMongoUri()

  if (!uri) {
    if (allowFallback || process.env.NODE_ENV !== "production") {
      return ensureInMemoryConnection()
    }

    throw new Error("Add MONGODB_URI to .env.local or set SEED_IN_MEMORY=true for demo mode")
  }

  if (seedFlag) {
    return ensureInMemoryConnection()
  }

  if (cached.conn) return cached.conn

  try {
    await connectMongo(uri)
    cached.conn = mongoose.connection
    return cached.conn
  } catch (error) {
    cached.promise = null

    if (allowFallback || process.env.NODE_ENV !== "production") {
      console.error("[database] Failed to connect to MongoDB. Falling back to in-memory store.", error)
      return ensureInMemoryConnection()
    }

    throw error
  }
}
