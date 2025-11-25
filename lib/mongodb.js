import mongoose from "mongoose";

import { initializeInMemoryDatabase } from "./in-memory";

const globalWithMongoose = global;

if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = { conn: null, promise: null };
}

export default async function dbConnect() {
  const hasUri = Boolean(process.env.MONGODB_URI);
  const seedFlag = process.env.SEED_IN_MEMORY;
  const useInMemory =
    seedFlag === "true" ||
    (!seedFlag && process.env.NODE_ENV !== "production") ||
    (!hasUri && process.env.NODE_ENV !== "production");
  const allowFallback = process.env.NODE_ENV !== "production" || process.env.ALLOW_DB_FALLBACK === "true";

  if (useInMemory) {
    if (!globalWithMongoose.__inMemoryDbInitialized) {
      await initializeInMemoryDatabase();
      globalWithMongoose.__inMemoryDbInitialized = true;
      console.warn(
        "[database] Running in demo mode with an in-memory data set. Set MONGODB_URI to connect to a persistent database.",
      );
    }

    if (!globalWithMongoose.mongoose.conn) {
      globalWithMongoose.mongoose.conn = { inMemory: true };
    }

    return globalWithMongoose.mongoose.conn;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Add MONGODB_URI to .env.local or set SEED_IN_MEMORY=true for demo mode");
  }

  if (globalWithMongoose.mongoose.conn) {
    return globalWithMongoose.mongoose.conn;
  }

  if (!globalWithMongoose.mongoose.promise) {
    globalWithMongoose.mongoose.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
      })
      .then((connection) => connection);
  }

  try {
    globalWithMongoose.mongoose.conn = await globalWithMongoose.mongoose.promise;
    return globalWithMongoose.mongoose.conn;
  } catch (error) {
    globalWithMongoose.mongoose.promise = null;

    if (allowFallback) {
      console.error("[database] Failed to connect to MongoDB. Falling back to in-memory store.", error);
      await initializeInMemoryDatabase();
      globalWithMongoose.__inMemoryDbInitialized = true;
      globalWithMongoose.mongoose.conn = { inMemory: true };
      return globalWithMongoose.mongoose.conn;
    }

    throw error;
  }
}
