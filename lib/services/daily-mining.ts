import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import Settings, { type ISettings } from "@/models/Settings"
import Balance from "@/models/Balance"
import User from "@/models/User"
import Transaction from "@/models/Transaction"
import TeamDailyProfit from "@/models/TeamDailyProfit"

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function endOfPreviousUtcDay(d: Date): Date {
  const end = startOfUtcDay(d)
  end.setUTCDate(end.getUTCDate() - 1)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

function startOfPreviousUtcDay(d: Date): Date {
  const start = startOfUtcDay(d)
  start.setUTCDate(start.getUTCDate() - 1)
  return start
}

function round(amount: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.round(amount * f) / f
}

function isValidObjectId(id: unknown): id is mongoose.Types.ObjectId | string {
  if (id instanceof mongoose.Types.ObjectId) return true
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id)
}

export async function runDailyMiningProfit(now: Date = new Date()) {
  await dbConnect()

  const [settingsDoc, balances] = await Promise.all([
    Settings.findOne().catch(() => null),
    Balance.find().select({ userId: 1, current: 1 }).lean(),
  ])

  const settings: Partial<ISettings> | null = settingsDoc
    ? ((typeof (settingsDoc as any).toObject === "function" ? (settingsDoc as any).toObject() : settingsDoc) as Partial<ISettings>)
    : null

  const userIds = balances
    .map((b) => (isValidObjectId(b.userId) ? (b.userId as any).toString() : null))
    .filter((v): v is string => !!v)

  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select({ _id: 1, miningDailyRateOverridePct: 1 })
        .lean()
    : []

  const rateByUser = new Map<string, number | null>()
  for (const u of users) {
    const k = (u._id as any).toString()
    const v = typeof (u as any).miningDailyRateOverridePct === "number" ? (u as any).miningDailyRateOverridePct : null
    rateByUser.set(k, v)
  }

  // Resolve global default
  const defaultRate = (() => {
    // Settings.dailyProfitPercent may be Decimal128 or number
    const raw = (settings?.dailyProfitPercent as any) ?? settings?.mining?.minPct ?? 1.5
    const num = typeof raw === "object" && raw !== null && typeof (raw as { toString?: () => string }).toString === "function" ? Number.parseFloat((raw as any).toString()) : Number(raw)
    return Number.isFinite(num) ? Number(num.toFixed(2)) : 1.5
  })()

  const windowStart = startOfPreviousUtcDay(now)
  const windowEnd = endOfPreviousUtcDay(now)
  const dayKey = windowStart.toISOString().slice(0, 10)

  let created = 0
  let skipped = 0
  let totalAmount = 0

  for (const b of balances) {
    const uid = isValidObjectId(b.userId) ? (b.userId as any).toString() : null
    if (!uid) continue
    const base = Number(b.current ?? 0)
    if (!Number.isFinite(base) || base <= 0) {
      skipped += 1
      continue
    }

    const overrideRate = rateByUser.get(uid)
    const rate = typeof overrideRate === "number" && overrideRate > 0 ? overrideRate : defaultRate
    const amount = round((base * rate) / 100, 2)
    if (amount <= 0) {
      skipped += 1
      continue
    }

    const uniqueKey = `DMP:${dayKey}:${uid}`
    const existing = await Transaction.findOne({ userId: new mongoose.Types.ObjectId(uid), "meta.uniqueKey": uniqueKey }).select({ _id: 1 }).lean()
    if (existing) {
      skipped += 1
      continue
    }

    await Balance.updateOne(
      { userId: new mongoose.Types.ObjectId(uid) },
      {
        $inc: { current: amount, totalBalance: amount, totalEarning: amount },
      },
      { upsert: true },
    )

    await Transaction.create({
      userId: new mongoose.Types.ObjectId(uid),
      type: "earn",
      amount,
      status: "approved",
      meta: {
        source: "daily_mining_profit",
        uniqueKey,
        day: dayKey,
        baseAmount: round(base, 2),
        ratePct: rate,
      },
      createdAt: windowEnd,
      updatedAt: windowEnd,
    } as any)

    // Upsert a TeamDailyProfit entry for the member for this day
    const existingDgp = await TeamDailyProfit.findOne({
      memberId: new mongoose.Types.ObjectId(uid),
      profitDate: { $gte: windowStart, $lte: windowEnd },
    }).select({ _id: 1 })

    if (!existingDgp) {
      await TeamDailyProfit.create({
        memberId: new mongoose.Types.ObjectId(uid),
        profitDate: windowEnd,
        profitAmount: amount,
        activeOnDate: true,
      } as any)
    }

    created += 1
    totalAmount = round(totalAmount + amount, 2)
  }

  console.info("[daily-mining] cycle completed", { day: dayKey, created, skipped, totalAmount, defaultRate })

  return { day: dayKey, created, skipped, totalAmount, defaultRate }
}

