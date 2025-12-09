export function resolveMongoUri() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.NEXT_PUBLIC_MONGODB_URI ||
    process.env.DATABASE_URL ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URI

  return uri?.trim() || undefined
}
