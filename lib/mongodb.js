import mongoose from "mongoose"

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error("Add MONGODB_URI to .env.local")
}

const globalWithMongoose = globalThis

const cached = globalWithMongoose.__mongooseCache || { conn: null, promise: null }

export default async function dbConnect() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
    })
  }

  cached.conn = await cached.promise
  globalWithMongoose.__mongooseCache = cached
  return cached.conn
}
