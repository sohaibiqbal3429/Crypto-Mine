import mongoose from "mongoose"

import { resolveMongoUri } from "./mongo-uri"

const connectionState: {
  promise: Promise<typeof mongoose> | null
} = {
  promise: null,
}

mongoose.set("strictQuery", true)
mongoose.set("maxTimeMS", Number(process.env.MONGO_MAX_TIME_MS || 5000))
mongoose.set("bufferTimeoutMS", Number(process.env.MONGO_BUFFER_TIMEOUT_MS || 1000))

export async function connectMongo(providedUri?: string) {
  if (mongoose.connection.readyState === 1) {
    return
  }

  const uri = providedUri || resolveMongoUri()

  if (!uri) {
    throw new Error("MONGODB_URI is not set")
  }

  process.env.MONGODB_URI = uri

  if (!connectionState.promise) {
    connectionState.promise = mongoose.connect(uri, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL || 50),
      minPoolSize: Number(process.env.MONGO_MIN_POOL || 5),
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT || 1000),
      connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT || 2000),
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT || 45_000),
      family: 4,
    })
  }

  await connectionState.promise
}
