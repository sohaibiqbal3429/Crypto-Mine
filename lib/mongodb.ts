import mongoose from "mongoose"

import { connectMongo } from "./db"
import { initializeInMemoryDatabase } from "./in-memory"

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

export default async function dbConnect() {
  const hasUri = Boolean(process.env.MONGODB_URI)
  const seedFlag = process.env.SEED_IN_MEMORY
  const preferInMemory =
    seedFlag === "true" ||
    (!seedFlag && process.env.NODE_ENV !== "production") ||
    (!hasUri && process.env.NODE_ENV !== "production")
  const allowFallback = process.env.NODE_ENV !== "production" || process.env.ALLOW_DB_FALLBACK === "true"

  if (preferInMemory) {
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

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("Add MONGODB_URI to .env.local or set SEED_IN_MEMORY=true for demo mode")
  }

  if (cached.conn) return cached.conn

  try {
    await connectMongo()
    cached.conn = mongoose.connection
    return cached.conn
  } catch (error) {
    cached.promise = null

    if (allowFallback) {
      console.error("[database] Failed to connect to MongoDB. Falling back to in-memory store.", error)
      await initializeInMemoryDatabase()
      globalWithMongoose.__inMemoryDbInitialized = true
      cached.conn = { inMemory: true }
      return cached.conn
    }

    throw error
  }
}
