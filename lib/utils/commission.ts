import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import CommissionRule from "@/models/CommissionRule"
import Settings, { type ISettings } from "@/models/Settings"
import Notification from "@/models/Notification"
import { isUserActiveByPolicy } from "@/lib/utils/policy"

const MIN_DEPOSIT_FOR_REWARDS = 80
const REFERRAL_LEVEL_COMMISSIONS = [0.05, 0.04, 0.03, 0.02, 0.01]
const DEPOSIT_COMMISSION_PCT = 0.02

function resolveMinRewardDeposit(settings?: ISettings | null): number {
  const configuredMin = settings?.gating?.activeMinDeposit ?? MIN_DEPOSIT_FOR_REWARDS
  return Math.max(configuredMin, MIN_DEPOSIT_FOR_REWARDS)
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

interface CalculateUserLevelOptions {
  suppressNotifications?: boolean
}

export async function calculateUserLevel(
  userId: string,
  options?: CalculateUserLevelOptions,
): Promise<number> {
  const [user, settings, directReferrals] = await Promise.all([
    User.findById(userId),
    Settings.findOne(),
    User.find({ referredBy: userId }).select(
      "depositTotal isActive first_qualifying_deposit_at first_qualifying_deposit_amount",
    ),
  ])

  if (!user) return 0

  const minDeposit = settings?.gating?.minDeposit ?? 30
  if (user.depositTotal < minDeposit) {
    if (user.level !== 0) {
      await User.updateOne({ _id: userId }, { level: 0 })
    }
    return 0
  }

  const activeDirectReferrals = directReferrals.filter((member) => isUserActiveByPolicy(member))
  const activeCount = activeDirectReferrals.length
  const directSalesVolume = directReferrals.reduce((sum, member) => sum + member.depositTotal, 0)

  const rules = await CommissionRule.find().sort({ level: 1 })

  let userLevel = 1
  for (const rule of rules) {
    if (activeCount >= rule.activeMin) {
      userLevel = rule.level
    } else {
      break
    }
  }

  if (userLevel >= 5 && activeCount < 35) {
    userLevel = 4
  }

  if (userLevel >= 5 && directSalesVolume < 7000) {
    userLevel = 4
  }

  const previousLevel = user.level ?? 0

  if (previousLevel !== userLevel) {
    await User.updateOne({ _id: userId }, { level: userLevel })

    if (!options?.suppressNotifications && userLevel > previousLevel) {
      await Notification.create({
        userId,
        kind: "level-up",
        title: "Level Up!",
        body: `Congratulations! You've reached Level ${userLevel}`,
      })
    }
  }

  return userLevel
}

interface ReferralChainEntry {
  level: number
  user: any
}

async function buildReferralChain(startingUser: any, maxLevels: number): Promise<ReferralChainEntry[]> {
  const chain: ReferralChainEntry[] = []
  let current: any = startingUser

  for (let level = 1; level <= maxLevels; level++) {
    const sponsorId = current?.referredBy
    if (!sponsorId) {
      break
    }

    const sponsor = await User.findById(sponsorId)
    if (!sponsor) {
      break
    }

    chain.push({ level, user: sponsor })
    current = sponsor
  }

  return chain
}

export async function processReferralCommission(
  referredUserId: string,
  depositAmount: number,
  settings?: ISettings | null,
  minRewardDeposit?: number,
) {
  const referredUser = await User.findById(referredUserId)
  if (!referredUser) return

  const resolvedSettings = settings ?? (await Settings.findOne())
  const requiredDeposit = minRewardDeposit ?? resolveMinRewardDeposit(resolvedSettings)

  if (depositAmount < requiredDeposit) return

  const referralChain = await buildReferralChain(referredUser, REFERRAL_LEVEL_COMMISSIONS.length)
  if (referralChain.length === 0) return

  for (const { level, user } of referralChain) {
    const pct = REFERRAL_LEVEL_COMMISSIONS[level - 1]
    const rewardAmount = roundCurrency(depositAmount * pct)
    if (rewardAmount <= 0) continue

    if (level === 1) {
      const referrerLevel = await calculateUserLevel(user._id.toString())

      await Balance.updateOne(
        { userId: user._id },
        {
          $inc: {
            current: rewardAmount,
            totalBalance: rewardAmount,
            totalEarning: rewardAmount,
          },
        },
        { upsert: true },
      )

      await Transaction.create({
        userId: user._id,
        type: "commission",
        amount: rewardAmount,
        meta: {
          source: "direct_referral",
          referredUserId,
          depositAmount,
          commissionPct: pct * 100,
          level: referrerLevel,
        },
      })

      await Notification.create({
        userId: user._id,
        kind: "referral-joined",
        title: "Referral Commission Earned",
        body: `You earned $${rewardAmount.toFixed(2)} commission from ${referredUser.name}'s deposit`,
      })
    } else {
      await Balance.updateOne(
        { userId: user._id },
        {
          $inc: {
            teamRewardsAvailable: rewardAmount,
          },
        },
        { upsert: true },
      )
    }
  }

  if (resolvedSettings && depositAmount >= resolvedSettings.joiningBonus.threshold) {
    const bonusAmount = roundCurrency((depositAmount * resolvedSettings.joiningBonus.pct) / 100)
    if (bonusAmount > 0) {
      await Balance.updateOne(
        { userId: referredUserId },
        {
          $inc: {
            current: bonusAmount,
            totalBalance: bonusAmount,
            totalEarning: bonusAmount,
          },
        },
        { upsert: true },
      )

      await Transaction.create({
        userId: referredUserId,
        type: "bonus",
        amount: bonusAmount,
        meta: {
          source: "joining_bonus",
          depositAmount,
          bonusPct: resolvedSettings.joiningBonus.pct,
        },
      })
    }
  }
}

export async function applyDepositRewards(userId: string, depositAmount: number) {
  const settings = await Settings.findOne()
  const requiredDeposit = resolveMinRewardDeposit(settings)

  if (depositAmount >= requiredDeposit) {
    const depositCommission = roundCurrency(depositAmount * DEPOSIT_COMMISSION_PCT)

    if (depositCommission > 0) {
      await Balance.updateOne(
        { userId },
        {
          $inc: {
            current: depositCommission,
            totalBalance: depositCommission,
            totalEarning: depositCommission,
          },
        },
        { upsert: true },
      )

      await Transaction.create({
        userId,
        type: "commission",
        amount: depositCommission,
        meta: {
          source: "deposit_commission",
          depositAmount,
          commissionPct: DEPOSIT_COMMISSION_PCT * 100,
        },
      })
    }
  }

  await processReferralCommission(userId, depositAmount, settings, requiredDeposit)
  await calculateUserLevel(userId)
}

export async function buildTeamTree(userId: string, maxDepth = 5): Promise<any> {
  const user = await User.findById(userId).select(
    "name email referralCode level depositTotal isActive createdAt first_qualifying_deposit_at first_qualifying_deposit_amount",
  )
  if (!user) return null

  if (maxDepth <= 0) return user

  const directReferrals = await User.find({ referredBy: userId })
    .select(
      "name email referralCode level depositTotal isActive createdAt first_qualifying_deposit_at first_qualifying_deposit_amount",
    )
    .sort({ createdAt: -1 })

  const children = []
  for (const referral of directReferrals) {
    const childTree = await buildTeamTree(referral._id.toString(), maxDepth - 1)
    if (childTree) {
      children.push(childTree)
    }
  }

  const userObject = user.toObject()

  return {
    ...userObject,
    firstQualifyingDepositAt: (userObject.first_qualifying_deposit_at as Date | undefined | null)?.toISOString?.() ?? null,
    firstQualifyingDepositAmount:
      typeof userObject.first_qualifying_deposit_amount === "number"
        ? userObject.first_qualifying_deposit_amount
        : null,
    children,
    directCount: directReferrals.length,
    activeCount: directReferrals.filter((r) => isUserActiveByPolicy(r)).length,
  }
}

export async function getTeamStats(userId: string) {
  // Get all descendants (team members)
  const allTeamMembers = await getAllTeamMembers(userId)

  // Calculate team statistics
  const totalMembers = allTeamMembers.length
  const activeMembers = allTeamMembers.filter((member) => isUserActiveByPolicy(member)).length
  const totalTeamDeposits = allTeamMembers.reduce((sum, member) => sum + member.depositTotal, 0)
  const totalTeamEarnings = allTeamMembers.reduce((sum, member) => sum + member.roiEarnedTotal, 0)

  // Get direct referrals
  const directReferrals = await User.find({ referredBy: userId })
  const directActive = directReferrals.filter((member) => isUserActiveByPolicy(member)).length

  return {
    totalMembers,
    activeMembers,
    directReferrals: directReferrals.length,
    directActive,
    totalTeamDeposits,
    totalTeamEarnings,
    levels: {
      level1: directReferrals.length,
      level2: await User.countDocuments({ referredBy: { $in: directReferrals.map((r) => r._id) } }),
      // Could expand to more levels as needed
    },
  }
}

async function getAllTeamMembers(userId: string, visited = new Set()): Promise<any[]> {
  if (visited.has(userId)) return []
  visited.add(userId)

  const directReferrals = await User.find({ referredBy: userId })
  let allMembers = [...directReferrals]

  for (const referral of directReferrals) {
    const subTeam = await getAllTeamMembers(referral._id.toString(), visited)
    allMembers = allMembers.concat(subTeam)
  }

  return allMembers
}
