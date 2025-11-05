import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

export type TaskType =
  | "referral"
  | "deposit"
  | "mining"
  | "profile"
  | "social"
  | "team"
  | "balance"
  | "daily"

export interface UserTask {
  id: string
  title: string
  description: string
  reward: number
  type: TaskType
  progress: number
  target: number
  completed: boolean
  rewardClaimed: boolean
  level?: number
}

export class TaskRewardError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

const REFERRAL_TARGET = 3
const FIRST_DEPOSIT_TARGET = 100
const MINING_SESSION_TARGET = 10
const PROFILE_COMPLETION_TARGET = 2
const LEVEL1_DEPOSIT_TARGET = 30
const LEVEL2_MINING_STREAK_TARGET = 3
const LEVEL2_BALANCE_STREAK_TARGET = 2
const LEVEL2_BALANCE_THRESHOLD = 50
const LEVEL3_MINING_STREAK_TARGET = 5
const LEVEL3_PERSONAL_DEPOSIT_TARGET = 150
const LEVEL3_REFERRAL_DEPOSIT_TARGET = 100
const LEVEL4_MINING_STREAK_TARGET = 7
const LEVEL4_REFERRAL_DEPOSIT_TARGET = 30
const LEVEL4_TEAM_DEPOSIT_TARGET = 300

interface TaskComputationContext {
  depositTotal: number
  referralCount: number
  miningSessionCount: number
  currentMiningStreak: number
  hasActivatedMining: boolean
  balanceCurrent: number
  balanceThresholdStreak50: number
  profileStepsCompleted: number
  joinedSocialProgress: number
  referralDepositorsOver30: number
  referralDepositorsOver100: number
  teamDepositVolume: number
}

interface LevelTaskDefinition {
  id: string
  title: string
  description: string
  reward: number
  type: TaskType
  target: number
  progress: (context: TaskComputationContext) => number
  completed?: (context: TaskComputationContext) => boolean
}

const LEVEL_TASK_DEFINITIONS: Record<number, LevelTaskDefinition[]> = {
  1: [
    {
      id: "level1-verify-profile",
      title: "Verify Email & Complete Profile",
      description: "Verify your email and phone number to complete your profile.",
      reward: 0.5,
      type: "profile",
      target: PROFILE_COMPLETION_TARGET,
      progress: (context) => context.profileStepsCompleted,
    },
    {
      id: "level1-join-social",
      title: "Join Official Channels",
      description: "Join the official Telegram or Twitter community.",
      reward: 0.5,
      type: "social",
      target: 1,
      progress: (context) => context.joinedSocialProgress,
    },
    {
      id: "level1-first-deposit",
      title: "Activate Mining with First Deposit",
      description: "Make your first deposit of 30 USDT and activate mining.",
      reward: 0.75,
      type: "deposit",
      target: LEVEL1_DEPOSIT_TARGET,
      progress: (context) => context.depositTotal,
      completed: (context) => context.depositTotal >= LEVEL1_DEPOSIT_TARGET && context.hasActivatedMining,
    },
  ],
  2: [
    {
      id: "level2-mining-streak",
      title: "Claim Mining Rewards 3 Days in a Row",
      description: "Log in daily and claim mining rewards for 3 consecutive days.",
      reward: 0.5,
      type: "mining",
      target: LEVEL2_MINING_STREAK_TARGET,
      progress: (context) => context.currentMiningStreak,
    },
    {
      id: "level2-invite-one",
      title: "Invite 1 New User",
      description: "Invite one new user through your referral link (sign-up only).",
      reward: 0.05,
      type: "referral",
      target: 1,
      progress: (context) => context.referralCount,
    },
    {
      id: "level2-balance-50",
      title: "Maintain 50 USDT Balance for 2 Days",
      description: "Maintain an active balance above 50 USDT for 2 consecutive days.",
      reward: 0.75,
      type: "balance",
      target: LEVEL2_BALANCE_STREAK_TARGET,
      progress: (context) => context.balanceThresholdStreak50,
      completed: (context) => context.balanceThresholdStreak50 >= LEVEL2_BALANCE_STREAK_TARGET,
    },
  ],
  3: [
    {
      id: "level3-refer-deposit-100",
      title: "Refer a 100 USDT Depositor",
      description: "Refer one user who deposits 100 USDT or more.",
      reward: 1,
      type: "referral",
      target: 1,
      progress: (context) => context.referralDepositorsOver100,
    },
    {
      id: "level3-mining-streak",
      title: "5-Day Mining Streak",
      description: "Maintain 5 consecutive active mining days.",
      reward: 0.75,
      type: "mining",
      target: LEVEL3_MINING_STREAK_TARGET,
      progress: (context) => context.currentMiningStreak,
    },
    {
      id: "level3-personal-deposit",
      title: "Reach 150 USDT in Personal Deposits",
      description: "Increase your total personal deposit to 150 USDT or more.",
      reward: 1.25,
      type: "deposit",
      target: LEVEL3_PERSONAL_DEPOSIT_TARGET,
      progress: (context) => context.depositTotal,
    },
  ],
  4: [
    {
      id: "level4-invite-three-depositors",
      title: "Invite 3 Active Depositors",
      description: "Invite three users who each deposit 30 USDT or more.",
      reward: 0.85,
      type: "referral",
      target: 3,
      progress: (context) => context.referralDepositorsOver30,
    },
    {
      id: "level4-team-deposit",
      title: "Team Deposit Volume of 300 USDT",
      description: "Achieve a total team deposit volume of 300 USDT or more.",
      reward: 1.5,
      type: "team",
      target: LEVEL4_TEAM_DEPOSIT_TARGET,
      progress: (context) => context.teamDepositVolume,
    },
    {
      id: "level4-mining-streak",
      title: "7-Day Mining Streak",
      description: "Maintain 7 consecutive active mining days.",
      reward: 1,
      type: "mining",
      target: LEVEL4_MINING_STREAK_TARGET,
      progress: (context) => context.currentMiningStreak,
    },
  ],
}

function toDateKey(date: Date): string {
  return new Date(date).toISOString().slice(0, 10)
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function calculateCurrentStreak(days: Set<string>, now = new Date()): number {
  if (days.size === 0) {
    return 0
  }

  let streak = 0
  const pointer = startOfUtcDay(now)

  while (true) {
    const key = toDateKey(pointer)
    if (!days.has(key)) {
      break
    }
    streak += 1
    pointer.setUTCDate(pointer.getUTCDate() - 1)
  }

  return streak
}

function calculateBalanceThresholdStreak(
  currentBalance: number,
  threshold: number,
  miningStreak: number,
  maxDays: number,
): number {
  if (currentBalance < threshold) {
    return 0
  }

  return Math.min(Math.max(miningStreak, 0), maxDays)
}

function clampProgress(value: number, target: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  if (!Number.isFinite(target) || target <= 0) {
    return Math.max(0, value)
  }

  return Math.min(Math.max(value, 0), target)
}

function hasJoinedSocialChannels(user: unknown): boolean {
  if (!user || typeof user !== "object") {
    return false
  }

  const record = user as Record<string, unknown>
  const directFlags = [
    record.joinedSocialChannels,
    record.joinedChannels,
    record.socialChannels,
    record.joinedTelegram,
    record.joinedTwitter,
    record.telegramJoined,
    record.twitterJoined,
    record.joinedOfficialChannels,
    record.joinedCommunity,
  ]

  for (const value of directFlags) {
    if (Array.isArray(value) && value.length > 0) {
      return true
    }
    if (typeof value === "boolean" && value) {
      return true
    }
    if (typeof value === "number" && value > 0) {
      return true
    }
    if (typeof value === "string" && value.trim().length > 0) {
      return true
    }
  }

  const nestedCandidates = [record.social, record.socialAccounts]
  for (const candidate of nestedCandidates) {
    if (!candidate || typeof candidate !== "object") {
      continue
    }
    for (const value of Object.values(candidate as Record<string, unknown>)) {
      if (typeof value === "boolean" && value) {
        return true
      }
      if (typeof value === "number" && value > 0) {
        return true
      }
      if (typeof value === "string" && value.trim().length > 0) {
        return true
      }
      if (Array.isArray(value) && value.length > 0) {
        return true
      }
    }
  }

  return false
}

function buildLevelTasks(
  level: number,
  context: TaskComputationContext,
  claimedTaskIds: Set<string>,
): UserTask[] {
  const definitions = LEVEL_TASK_DEFINITIONS[level]
  if (!definitions?.length) {
    return []
  }

  return definitions.map((definition) => {
    const rawProgress = definition.progress(context)
    const progress = clampProgress(rawProgress, definition.target)
    const isCompleted =
      typeof definition.completed === "function"
        ? definition.completed(context)
        : rawProgress >= definition.target

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      reward: definition.reward,
      type: definition.type,
      progress,
      target: definition.target,
      completed: isCompleted,
      rewardClaimed: claimedTaskIds.has(definition.id),
      level,
    }
  })
}

function buildLegacyTasks(
  context: TaskComputationContext,
  claimedTaskIds: Set<string>,
): UserTask[] {
  const clampedDepositProgress = Math.min(context.depositTotal, FIRST_DEPOSIT_TARGET)
  const clampedMiningSessions = Math.min(context.miningSessionCount, MINING_SESSION_TARGET)

  return [
    {
      id: "refer-3-friends",
      title: "Refer 3 Friends",
      description: "Invite 3 friends to join the platform",
      reward: 2,
      type: "referral",
      progress: Math.min(context.referralCount, REFERRAL_TARGET),
      target: REFERRAL_TARGET,
      completed: context.referralCount >= REFERRAL_TARGET,
      rewardClaimed: claimedTaskIds.has("refer-3-friends"),
    },
    {
      id: "first-deposit",
      title: "First Deposit",
      description: "Make your first deposit of $100 or more",
      reward: 2,
      type: "deposit",
      progress: clampedDepositProgress,
      target: FIRST_DEPOSIT_TARGET,
      completed: context.depositTotal >= FIRST_DEPOSIT_TARGET,
      rewardClaimed: claimedTaskIds.has("first-deposit"),
    },
    {
      id: "mine-10-times",
      title: "Mine 10 Times",
      description: "Complete 10 mining sessions",
      reward: 0.5,
      type: "mining",
      progress: clampedMiningSessions,
      target: MINING_SESSION_TARGET,
      completed: context.miningSessionCount >= MINING_SESSION_TARGET,
      rewardClaimed: claimedTaskIds.has("mine-10-times"),
    },
  ]
}

export async function getTasksForUser(userId: string): Promise<UserTask[]> {
  await dbConnect()

  const user = await User.findById(userId)
  if (!user) {
    throw new Error("User not found")
  }

  const [balanceDoc, miningTransactions, claimedRewards, directReferrals] = await Promise.all([
    Balance.findOne({ userId: user._id }).lean<{ current?: number } | null>(),
    Transaction.find({ userId: user._id, type: "earn", "meta.source": "mining" })
      .select({ createdAt: 1 })
      .sort({ createdAt: -1 })
      .lean<{ createdAt: Date | string }[]>(),
    Transaction.find({
      userId: user._id,
      type: "bonus",
      "meta.source": "task_reward",
    })
      .select({ "meta.taskId": 1 })
      .lean(),
    User.find({ referredBy: user._id })
      .select({ depositTotal: 1 })
      .lean<{ depositTotal?: number | null }[]>(),
  ])

  const claimedTaskIds = new Set<string>()
  for (const record of claimedRewards) {
    const taskId = (record as { meta?: { taskId?: unknown } })?.meta?.taskId
    if (typeof taskId === "string") {
      claimedTaskIds.add(taskId)
    }
  }

  const depositTotal = Number(user.depositTotal ?? 0)
  const miningSessionCount = miningTransactions.length
  const miningDays = new Set<string>()
  for (const tx of miningTransactions) {
    const createdAt = tx?.createdAt
    if (!createdAt) {
      continue
    }
    const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
    if (!Number.isNaN(date.getTime())) {
      miningDays.add(toDateKey(date))
    }
  }
  const currentMiningStreak = calculateCurrentStreak(miningDays)
  const hasActivatedMining = miningSessionCount > 0

  const balanceCurrent = Number(balanceDoc?.current ?? 0)
  const referralCount = directReferrals.length
  const referralDeposits = directReferrals.map((item) => Number(item?.depositTotal ?? 0))
  const referralDepositorsOver30 = referralDeposits.filter((value) => value >= LEVEL4_REFERRAL_DEPOSIT_TARGET).length
  const referralDepositorsOver100 = referralDeposits.filter((value) => value >= LEVEL3_REFERRAL_DEPOSIT_TARGET).length
  const teamDepositVolume = referralDeposits.reduce((total, value) => total + value, 0)

  const balanceThresholdStreak50 = calculateBalanceThresholdStreak(
    balanceCurrent,
    LEVEL2_BALANCE_THRESHOLD,
    currentMiningStreak,
    LEVEL2_BALANCE_STREAK_TARGET,
  )

  const profileStepsCompleted =
    (user.emailVerified ? 1 : 0) + (user.phone && user.phoneVerified ? 1 : 0)
  const joinedSocialProgress = hasJoinedSocialChannels(user) ? 1 : 0

  const context: TaskComputationContext = {
    depositTotal,
    referralCount,
    miningSessionCount,
    currentMiningStreak,
    hasActivatedMining,
    balanceCurrent,
    balanceThresholdStreak50,
    profileStepsCompleted,
    joinedSocialProgress,
    referralDepositorsOver30,
    referralDepositorsOver100,
    teamDepositVolume,
  }

  const userLevel = Number(user.level ?? 0)
  if (userLevel > 0) {
    const definedLevels = Object.keys(LEVEL_TASK_DEFINITIONS)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b)

    const accessibleLevels = definedLevels.filter((level) => level <= userLevel)

    const levelTasks = accessibleLevels.flatMap((level) => buildLevelTasks(level, context, claimedTaskIds))

    if (levelTasks.length > 0) {
      return levelTasks
    }

    const highestDefinedLevel = definedLevels.at(-1)
    if (highestDefinedLevel) {
      const fallbackTasks = buildLevelTasks(highestDefinedLevel, context, claimedTaskIds)
      if (fallbackTasks.length > 0) {
        return fallbackTasks
      }
    }

    return []
  }

  return buildLegacyTasks(context, claimedTaskIds)
}

export async function claimTaskReward(userId: string, taskId: string) {
  await dbConnect()

  const tasks = await getTasksForUser(userId)
  const task = tasks.find((item) => item.id === taskId)

  if (!task) {
    throw new TaskRewardError("Task not found", 404)
  }

  if (!task.completed) {
    throw new TaskRewardError("Task has not been completed yet", 400)
  }

  if (task.rewardClaimed) {
    throw new TaskRewardError("Reward already claimed for this task", 409)
  }

  let balance = await Balance.findOne({ userId })
  if (!balance) {
    balance = await Balance.create({
      userId,
      current: 0,
      totalBalance: 0,
      totalEarning: 0,
      lockedCapital: 0,
      staked: 0,
      pendingWithdraw: 0,
      teamRewardsAvailable: 0,
      teamRewardsClaimed: 0,
    })
  }

  const rewardAmount = Number(task.reward) || 0
  const claimDate = new Date()

  balance.current = Number(balance.current ?? 0) + rewardAmount
  balance.totalBalance = Number(balance.totalBalance ?? 0) + rewardAmount
  balance.totalEarning = Number(balance.totalEarning ?? 0) + rewardAmount

  await balance.save()

  const transaction = await Transaction.create({
    userId,
    type: "bonus",
    amount: rewardAmount,
    meta: {
      source: "task_reward",
      taskId: task.id,
      taskTitle: task.title,
      claimedAt: claimDate.toISOString(),
    },
    status: "approved",
  })

  return {
    reward: rewardAmount,
    claimedAt: claimDate.toISOString(),
    transactionId: transaction._id?.toString?.() ?? "",
    balance: {
      current: Number(balance.current ?? 0),
      totalBalance: Number(balance.totalBalance ?? 0),
      totalEarning: Number(balance.totalEarning ?? 0),
    },
  }
}
