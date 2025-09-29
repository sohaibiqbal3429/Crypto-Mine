import mongoose from "mongoose"

const uri = process.env.MONGODB_URI!

if (!uri) {
  throw new Error("Add MONGODB_URI to .env.local")
}

const cached: any = (global as any).mongoose || { conn: null, promise: null }

export default async function dbConnect() {
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
