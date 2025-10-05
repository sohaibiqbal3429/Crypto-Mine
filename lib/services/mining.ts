import dbConnect from "@/lib/mongodb"
import Settings from "@/models/Settings"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import MiningSession from "@/models/MiningSession"
import { calculateMiningProfit, hasReachedROICap } from "@/lib/utils/referral"
import { applyTeamProfitOverrides } from "@/lib/utils/commission"

const DEFAULT_MINING_SETTINGS = {
  minPct: 2.5,
  maxPct: 2.5,
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
    minPct: number
    maxPct: number
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

  const settings = {
    minPct: DEFAULT_MINING_SETTINGS.minPct,
    maxPct: DEFAULT_MINING_SETTINGS.maxPct,
    roiCap: settingsDoc?.mining?.roiCap ?? DEFAULT_MINING_SETTINGS.roiCap,
  }
  const requiredDeposit = settingsDoc?.gating?.minDeposit ?? 30
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

export async function performMiningClick(userId: string) {
  await dbConnect()

  const [user, settingsDoc] = await Promise.all([
    User.findById(userId),
    Settings.findOne(),
  ])

  if (!user) {
    throw new MiningActionError("User not found", 404)
  }

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

  const settings = {
    minPct: DEFAULT_MINING_SETTINGS.minPct,
    maxPct: DEFAULT_MINING_SETTINGS.maxPct,
    roiCap: settingsDoc?.mining?.roiCap ?? DEFAULT_MINING_SETTINGS.roiCap,
  }

  const requiredDeposit = settingsDoc?.gating?.minDeposit ?? 30
  if (user.depositTotal < requiredDeposit) {
    throw new MiningActionError(`Mining requires a minimum deposit of $${requiredDeposit} USDT`, 403)
  }

  const roiCapLimit = user.depositTotal > 0 ? user.depositTotal * settings.roiCap : null

  if (roiCapLimit !== null && hasReachedROICap(user.roiEarnedTotal, user.depositTotal, settings.roiCap)) {
    throw new MiningActionError(`ROI cap reached (${settings.roiCap}x)`, 400)
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

  const baseAmount = user.depositTotal
  const profit = calculateMiningProfit(baseAmount, settings.minPct, settings.maxPct)

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

  await Balance.updateOne(
    { userId: user._id },
    {
      $inc: {
        current: finalProfit,
        totalBalance: finalProfit,
        totalEarning: finalProfit,
      },
    },
  )

  await User.updateOne({ _id: user._id }, { $inc: { roiEarnedTotal: finalProfit } })

  const profitTransaction = await Transaction.create({
    userId: user._id,
    type: "earn",
    amount: finalProfit,
    status: "approved",
    meta: {
      source: "mining",
      baseAmount,
      profitPct: (finalProfit / baseAmount) * 100,
      roiCapReached,
      originalProfit: profit,
    },
  })

  await applyTeamProfitOverrides(user._id.toString(), finalProfit, {
    profitTransactionId: profitTransaction._id.toString(),
    profitDate: now,
    profitSource: "mining",
    baseAmount,
  })

  const nextEligible = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  await MiningSession.updateOne(
    { userId: user._id },
    {
      lastClickAt: now,
      nextEligibleAt: nextEligible,
      earnedInCycle: finalProfit,
    },
  )

  await Notification.create({
    userId: user._id,
    kind: "mining-reward",
    title: "Mining Reward Earned",
    body: `You earned $${finalProfit.toFixed(2)} from mining! ${roiCapReached ? "ROI cap reached." : ""}`,
  })

  return {
    profit: finalProfit,
    baseAmount,
    profitPct: (finalProfit / baseAmount) * 100,
    roiCapReached,
    nextEligibleAt: nextEligible.toISOString(),
    newBalance: (balance.current ?? 0) + finalProfit,
    roiEarnedTotal: user.roiEarnedTotal + finalProfit,
  }
}
