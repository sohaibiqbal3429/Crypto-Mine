import mongoose from "mongoose"

const connectionState: {
  promise: Promise<typeof mongoose> | null
} = {
  promise: null,
}

mongoose.set("strictQuery", true)

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) {
    return
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set")
  }

  if (!connectionState.promise) {
    connectionState.promise = mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL || 50),
      minPoolSize: Number(process.env.MONGO_MIN_POOL || 5),
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT || 1000),
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT || 45_000),
      family: 4,
    })
  }

  await connectionState.promise
}
