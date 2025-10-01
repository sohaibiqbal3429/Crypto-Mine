import mongoose from "mongoose"

const cached: any = (global as any).mongoose || { conn: null, promise: null }

export default async function dbConnect() {
  const uri = process.env.MONGODB_URI
  const useInMemory = process.env.SEED_IN_MEMORY === "true"

  if (!uri) {
    if (useInMemory) {
      return null
    }

    throw new Error("Add MONGODB_URI to .env.local")
  }

  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
      })
      .then((mongoose) => mongoose)
  }

  cached.conn = await cached.promise
  return cached.conn
}
