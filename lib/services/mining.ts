import dbConnect from "@/lib/mongodb"
import Settings, { type ISettings } from "@/models/Settings"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import MiningSession from "@/models/MiningSession"
import { calculateMiningProfit, hasReachedROICap } from "@/lib/utils/referral"
import { createTeamEarningPayouts } from "@/lib/services/rewards"
import { resolveDailyProfitPercent } from "@/lib/services/settings"
import { calculatePercentFromAmounts } from "@/lib/utils/numeric"
import mongoose from "mongoose"

const DEFAULT_MINING_SETTINGS = {
  dailyProfitPercent: 1.5,
  roiCap: 3,
}

export class MiningActionError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export interface MiningStatusResult {
  canMine: boolean
  roiCapReached: boolean
  requiresDeposit: boolean
  minDeposit: number
  timeLeft: number
  nextEligibleAt: string | null
  lastClickAt: string | null
  earnedInCycle: number
  baseAmount: number
  miningSettings: {
    dailyProfitPercent: number
    roiCap: number
  }
  userStats: {
    depositTotal: number
    roiEarnedTotal: number
    currentBalance: number
    totalEarning: number
    roiProgress: number
  }
  totalClicks: number
}

export async function getMiningStatus(userId: string): Promise<MiningStatusResult> {
  await dbConnect()

  const [user, balanceDoc, sessionDoc, settingsDoc] = await Promise.all([
    User.findById(userId),
    Balance.findOne({ userId }),
    MiningSession.findOne({ userId }),
    Settings.findOne(),
  ])

  if (!user) {
    throw new MiningActionError("User not found", 404)
  }

  let balance = balanceDoc
  if (!balance) {
    balance = await Balance.create({
      userId: user._id,
      current: 0,
      totalBalance: 0,
      totalEarning: 0,
      lockedCapital: 0,
      staked: 0,
      pendingWithdraw: 0,
    })
  }

  let miningSession = sessionDoc
  if (!miningSession) {
    miningSession = await MiningSession.create({ userId: user._id })
  }

  const plainSettings = settingsDoc
    ? ((typeof settingsDoc.toObject === "function" ? settingsDoc.toObject() : settingsDoc) as Partial<ISettings>)
    : null

  const dailyProfitPercent = resolveDailyProfitPercent(plainSettings)
  const settings = {
    dailyProfitPercent,
    roiCap: plainSettings?.mining?.roiCap ?? DEFAULT_MINING_SETTINGS.roiCap,
  }
  const requiredDeposit = plainSettings?.gating?.minDeposit ?? 30
  const hasMinimumDeposit = user.depositTotal >= requiredDeposit

  const totalMiningClicks = await Transaction.countDocuments({
    userId: user._id,
    type: "earn",
    "meta.source": "mining",
  })

  const now = new Date()
  const canMineNow = (!miningSession.nextEligibleAt || now >= miningSession.nextEligibleAt) && hasMinimumDeposit
  const roiCapReached = hasReachedROICap(user.roiEarnedTotal, user.depositTotal, settings.roiCap)
  const baseAmount = hasMinimumDeposit ? user.depositTotal : 0

  let timeLeft = 0
  if (miningSession.nextEligibleAt && now < miningSession.nextEligibleAt) {
    timeLeft = Math.ceil((miningSession.nextEligibleAt.getTime() - now.getTime()) / 1000)
  }

  return {
    canMine: canMineNow && !roiCapReached,
    roiCapReached,
    requiresDeposit: !hasMinimumDeposit,
    minDeposit: requiredDeposit,
    timeLeft,
    nextEligibleAt: miningSession.nextEligibleAt?.toISOString() || null,
    lastClickAt: miningSession.lastClickAt?.toISOString() || null,
    earnedInCycle: miningSession.earnedInCycle || 0,
    baseAmount,
    miningSettings: settings,
    userStats: {
      depositTotal: user.depositTotal,
      roiEarnedTotal: user.roiEarnedTotal,
      currentBalance: balance.current ?? 0,
      totalEarning: balance.totalEarning ?? 0,
      roiProgress:
        user.depositTotal > 0 ? (user.roiEarnedTotal / (user.depositTotal * settings.roiCap)) * 100 : 0,
    },
    totalClicks: totalMiningClicks,
  }
}

export interface PerformMiningClickOptions {
  idempotencyKey?: string
}

export interface MiningClickResult {
  profit: number
  baseAmount: number
  profitPct: number
  roiCapReached: boolean
  nextEligibleAt: string
  newBalance: number
  roiEarnedTotal: number
}

export async function performMiningClick(
  userId: string,
  options: PerformMiningClickOptions = {},
): Promise<MiningClickResult> {
  await dbConnect()

  const [user, settingsDoc] = await Promise.all([
    User.findById(userId),
    Settings.findOne(),
  ])

  if (!user) {
    throw new MiningActionError("User not found", 404)
  }

  // Resolve settings
  const plainSettings = settingsDoc
    ? ((typeof settingsDoc.toObject === "function" ? settingsDoc.toObject() : settingsDoc) as Partial<ISettings>)
    : null

  const dailyProfitPercent = resolveDailyProfitPercent(plainSettings)
  const settings = {
    dailyProfitPercent,
    roiCap: plainSettings?.mining?.roiCap ?? DEFAULT_MINING_SETTINGS.roiCap,
  }

  const requiredDeposit = plainSettings?.gating?.minDeposit ?? 30
  if (user.depositTotal < requiredDeposit) {
    throw new MiningActionError(`Mining requires a minimum deposit of $${requiredDeposit} USDT`, 403)
  }

  const idempotencyKey = options.idempotencyKey

  if (idempotencyKey) {
    const priorTransaction = await Transaction.findOne({
      userId: user._id,
      type: "earn",
      "meta.source": "mining",
      "meta.idempotencyKey": idempotencyKey,
    }).lean()

    const priorResult = priorTransaction?.meta?.miningResult as MiningClickResult | undefined
    if (priorResult) {
      return priorResult
    }
  }

  // Ensure we have related docs
  let balance = await Balance.findOne({ userId: user._id })
  if (!balance) {
    balance = await Balance.create({
      userId: user._id,
      current: 0,
      totalBalance: 0,
      totalEarning: 0,
      lockedCapital: 0,
      staked: 0,
      pendingWithdraw: 0,
    })
  }

  let miningSession = await MiningSession.findOne({ userId: user._id })
  if (!miningSession) {
    miningSession = await MiningSession.create({ userId: user._id })
  }

  const now = new Date()
  if (miningSession.nextEligibleAt && now < miningSession.nextEligibleAt) {
    const timeLeft = Math.ceil((miningSession.nextEligibleAt.getTime() - now.getTime()) / 1000)
    const error = new MiningActionError("Mining cooldown active", 400)
    ;(error as any).details = { timeLeft, nextEligibleAt: miningSession.nextEligibleAt.toISOString() }
    throw error
  }

  // Base amount for mining profit calculation is the user's current wallet balance
  const baseAmount = Number(balance.current ?? 0)
  const profit = calculateMiningProfit(baseAmount, settings.dailyProfitPercent)

  // Respect ROI cap
  const roiCapLimit = user.depositTotal > 0 ? user.depositTotal * settings.roiCap : null
  const newRoiTotal = user.roiEarnedTotal + profit
  let finalProfit = profit
  let roiCapReached = false

  if (roiCapLimit !== null && newRoiTotal > roiCapLimit) {
    const remainingProfit = roiCapLimit - user.roiEarnedTotal
    if (remainingProfit <= 0) {
      throw new MiningActionError(`ROI cap reached (${settings.roiCap}x)`, 400)
    }
    finalProfit = remainingProfit
    roiCapReached = true
  }

  // ---- ATOMIC TRANSACTION: credit + tx + cooldown + notification + TEAM PAYOUTS ----
  const session = await mongoose.startSession()
  try {
    let result: MiningClickResult

    await session.withTransaction(async () => {
      // 1) Credit balance and earnings
      await Balance.updateOne(
        { userId: user._id },
        {
          $inc: {
            current: finalProfit,
            totalBalance: finalProfit,
            totalEarning: finalProfit,
          },
        },
        { session },
      )

      await User.updateOne(
        { _id: user._id },
        { $inc: { roiEarnedTotal: finalProfit } },
        { session },
      )

      // 2) Record earn transaction (source of truth for idempotency of team-earnings)
      const miningResult: MiningClickResult = {
        profit: finalProfit,
        baseAmount,
        profitPct: calculatePercentFromAmounts(finalProfit, baseAmount),
        roiCapReached,
        nextEligibleAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        newBalance: Number(balance.current ?? 0) + finalProfit,
        roiEarnedTotal: user.roiEarnedTotal + finalProfit,
      }

      const profitTransaction = await Transaction.create(
        [
          {
            userId: user._id,
            type: "earn",
            amount: finalProfit,
            status: "approved",
            meta: {
              source: "mining",
              idempotencyKey,
              baseAmount,
              profitPct: miningResult.profitPct,
              roiCapReached,
              originalProfit: profit,
              miningResult,
            },
          },
        ],
        { session },
      ).then((docs) => docs[0])

      // 3) Update mining session cooldown
      const nextEligible = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      await MiningSession.updateOne(
        { userId: user._id },
        {
          lastClickAt: now,
          nextEligibleAt: nextEligible,
          earnedInCycle: finalProfit,
        },
        { session },
      )

      // 4) Notify user
      await Notification.create(
        [
          {
            userId: user._id,
            kind: "mining-reward",
            title: "Mining Reward Earned",
            body: `You earned $${finalProfit.toFixed(2)} from mining! ${roiCapReached ? "ROI cap reached." : ""}`,
          },
        ],
        { session },
      )

      // 5) TEAM DAILY EARNINGS (Claimables): L1 = 2%, L2 = 1%
      // Idempotent at rewards layer via (type, sourceTxId, receiverUserId) unique key.
      await createTeamEarningPayouts(user._id.toString(), finalProfit, {
        earningTransactionId: profitTransaction._id.toString(),
        earningAt: now,
        // if your rewards service supports sessions, this ensures full atomicity:
        // @ts-ignore optional for in-memory, used in real Mongo
        session,
      })

      result = miningResult
    })

    // @ts-expect-error set in transaction scope
    return result!
  } finally {
    await session.endSession()
  }
}
