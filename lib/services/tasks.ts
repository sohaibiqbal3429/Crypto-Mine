import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

export type TaskType = "referral" | "deposit" | "mining"

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

export async function getTasksForUser(userId: string): Promise<UserTask[]> {
  await dbConnect()

  const user = await User.findById(userId)
  if (!user) {
    throw new Error("User not found")
  }

  const [referralCount, miningSessions, claimedRewards] = await Promise.all([
    User.countDocuments({ referredBy: user._id }),
    Transaction.countDocuments({ userId: user._id, type: "earn", "meta.source": "mining" }),
    Transaction.find({
      userId: user._id,
      type: "bonus",
      "meta.source": "task_reward",
    })
      .select({ "meta.taskId": 1 })
      .lean(),
  ])

  const depositTotal = user.depositTotal ?? 0
  const clampedDepositProgress = Math.min(depositTotal, FIRST_DEPOSIT_TARGET)
  const clampedMiningSessions = Math.min(miningSessions, MINING_SESSION_TARGET)

  const claimedTaskIds = new Set<string>()
  for (const record of claimedRewards) {
    const taskId = (record as { meta?: { taskId?: unknown } })?.meta?.taskId
    if (typeof taskId === "string") {
      claimedTaskIds.add(taskId)
    }
  }

  return [
    {
      id: "refer-3-friends",
      title: "Refer 3 Friends",
      description: "Invite 3 friends to join the platform",
      reward: 2,
      type: "referral",
      progress: referralCount,
      target: REFERRAL_TARGET,
      completed: referralCount >= REFERRAL_TARGET,
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
      completed: depositTotal >= FIRST_DEPOSIT_TARGET,
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
      completed: miningSessions >= MINING_SESSION_TARGET,
      rewardClaimed: claimedTaskIds.has("mine-10-times"),
    },
  ]
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
