import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import Settings, { type ISettings } from "@/models/Settings"
import Balance from "@/models/Balance"
import User from "@/models/User"
import Transaction from "@/models/Transaction"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import { getPolicyEffectiveAt, isPolicyEffectiveFor } from "@/lib/utils/policy"

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

<<<<<<< HEAD
// 4-decimal precision as per platform spec
function round(amount: number, decimals = 4): number {
=======
const PLATFORM_DECIMALS = 4

function round(amount: number, decimals = PLATFORM_DECIMALS): number {
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
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
    // NOTE: daily mining must use CURRENT balance only
    Balance.find().select({ userId: 1, current: 1 }).lean(),
  ])

  const settings: Partial<ISettings> | null = settingsDoc
    ? ((typeof (settingsDoc as any).toObject === "function" ? (settingsDoc as any).toObject() : settingsDoc) as Partial<ISettings>)
    : null

  const userIds = balances
    .map((b) => (isValidObjectId(b.userId) ? (b.userId as any).toString() : null))
    .filter((v): v is string => !!v)

  // bring isActive + optional user-specific rate
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select({ _id: 1, miningDailyRateOverridePct: 1, isActive: 1 })
        .lean()
    : []

  const rateByUser = new Map<string, number | null>()
  const activeByUser = new Map<string, boolean>()
  for (const u of users) {
    const k = (u._id as any).toString()
    const v =
      typeof (u as any).miningDailyRateOverridePct === "number"
        ? (u as any).miningDailyRateOverridePct
        : null
    rateByUser.set(k, v)
    activeByUser.set(k, Boolean((u as any).isActive))
  }

  // Resolve global default rate (from settings; fallback 1.5%)
  const defaultRate = (() => {
    const raw = (settings?.dailyProfitPercent as any) ?? settings?.mining?.minPct ?? 1.5
    const num =
      typeof raw === "object" &&
      raw !== null &&
      typeof (raw as { toString?: () => string }).toString === "function"
        ? Number.parseFloat((raw as any).toString())
        : Number(raw)
    return Number.isFinite(num) ? Number(num.toFixed(2)) : 1.5
  })()

  const windowStart = startOfPreviousUtcDay(now)
  const windowEnd = endOfPreviousUtcDay(now)
  const dayKey = windowStart.toISOString().slice(0, 10)

  let created = 0
  let skipped = 0
  let totalAmount = 0
  let duplicatesPrevented = 0

  const effectiveAt = getPolicyEffectiveAt()

  for (const b of balances) {
    const uid = isValidObjectId(b.userId) ? (b.userId as any).toString() : null
    if (!uid) {
      skipped += 1
      continue
    }

    // base MUST be current balance (never total)
    const base = Number(b.current ?? 0)
    if (!Number.isFinite(base) || base <= 0) {
      skipped += 1
      continue
    }

    const overrideRate = rateByUser.get(uid)
    const rate = typeof overrideRate === "number" && overrideRate > 0 ? overrideRate : defaultRate
<<<<<<< HEAD

    // daily profit at 4 d.p.
    const amount = round((base * rate) / 100, 4)
=======
    const amount = round((base * rate) / 100)
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
    if (amount <= 0) {
      skipped += 1
      continue
    }

<<<<<<< HEAD
    // idempotent per (user, day)
    const uniqueKey = `DMP:${dayKey}:${uid}`
    const existing = await Transaction.findOne({
      userId: new mongoose.Types.ObjectId(uid),
      "meta.uniqueKey": uniqueKey,
      type: "earn",
      "meta.source": "daily_mining_profit",
    })
      .select({ _id: 1 })
      .lean()

    if (existing) {
=======
    if (!isPolicyEffectiveFor(windowEnd)) {
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
      skipped += 1
      console.info("[daily-mining] duplicate_prevented", { userId: uid, dayKey, uniqueKey })
      continue
    }

<<<<<<< HEAD
    // CREDIT: only current + lifetime; DO NOT touch totalBalance in daily job
    await Balance.updateOne(
      { userId: new mongoose.Types.ObjectId(uid) },
      {
        $inc: {
          current: amount,
          totalEarning: amount,
        },
      },
      { upsert: true },
    )
=======
    const uniqueKey = `${uid}|${dayKey}|mining`
    const existingDoc = await Transaction.findOne({
      userId: new mongoose.Types.ObjectId(uid),
      "meta.uniqueKey": uniqueKey,
    })
    if (existingDoc) {
      skipped += 1
      duplicatesPrevented += 1
      continue
    }

    const userObjectId = mongoose.Types.ObjectId.isValid(uid) ? new mongoose.Types.ObjectId(uid) : null
    let updated = false

    const applyIncrement = async (filter: Record<string, unknown>) => {
      if (updated) return
      const result = await Balance.updateOne(
        filter,
        { $inc: { current: amount, totalEarning: amount } },
      )
      if ((result as any)?.modifiedCount > 0 || (result as any)?.matchedCount > 0) {
        updated = true
      }
    }

    await applyIncrement({ userId: uid })
    if (!updated && userObjectId) {
      await applyIncrement({ userId: userObjectId })
    }

    if (!updated) {
      await Balance.create({
        userId: userObjectId ?? new mongoose.Types.ObjectId(uid),
        current: amount,
        totalBalance: 0,
        totalEarning: amount,
      } as any)
    }
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7

    await Transaction.create({
      userId: new mongoose.Types.ObjectId(uid),
      type: "earn",
      amount,
      status: "approved",
      meta: {
        source: "daily_mining_profit",
        uniqueKey,
        day: dayKey,
<<<<<<< HEAD
        baseAmount: round(base, 4),
=======
        baseAmount: round(base),
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
        ratePct: rate,
        eventId: uniqueKey,
      },
      createdAt: windowEnd,
      updatedAt: windowEnd,
    } as any)

    // Mark/Upsert TeamDailyProfit with active flag from User.isActive
    const existingDgp = await TeamDailyProfit.findOne({
      memberId: new mongoose.Types.ObjectId(uid),
      profitDate: { $gte: windowStart, $lte: windowEnd },
<<<<<<< HEAD
    }).select({ _id: 1, activeOnDate: 1 })

    const memberActive = activeByUser.get(uid) ?? false
=======
    })
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7

    if (!existingDgp) {
      await TeamDailyProfit.create({
        memberId: new mongoose.Types.ObjectId(uid),
        profitDate: windowEnd,
        profitAmount: amount,
        activeOnDate: memberActive,
      } as any)
    } else if (existingDgp.activeOnDate !== memberActive) {
      await TeamDailyProfit.updateOne(
        { _id: existingDgp._id },
        { $set: { activeOnDate: memberActive } },
      )
    }

    console.info("[daily-mining] credit", {
      event_id: uniqueKey,
      level: "base",
      percentage: rate,
      base_amount: round(base),
      source: "daily",
    })

    created += 1
<<<<<<< HEAD
    totalAmount = round(totalAmount + amount, 4)
=======
    totalAmount = round(totalAmount + amount)
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
  }

  console.info("[daily-mining] cycle completed", {
    day: dayKey,
    created,
    skipped,
<<<<<<< HEAD
    totalAmount,
    defaultRate,
=======
    totalAmount: round(totalAmount),
    defaultRate,
    duplicatesPrevented,
    effectiveFrom: effectiveAt.toISOString(),
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
  })

  return { day: dayKey, created, skipped, totalAmount, defaultRate }
}
