import Cache from "@/models/Cache"

export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const now = new Date()
  const existing = await Cache.findOne({ key, expiresAt: { $gt: now } }).lean<{ value: T }>()

  if (existing?.value !== undefined) {
    return existing.value
  }

  const value = await compute()
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

  await Cache.updateOne(
    { key },
    { $set: { key, value, expiresAt } },
    { upsert: true },
  )

  return value
}
