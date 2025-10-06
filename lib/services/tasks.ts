import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Transaction from "@/models/Transaction"

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

  const [referralCount, miningSessions] = await Promise.all([
    User.countDocuments({ referredBy: user._id }),
    Transaction.countDocuments({ userId: user._id, type: "earn", "meta.source": "mining" }),
  ])

  const depositTotal = user.depositTotal ?? 0
  const clampedDepositProgress = Math.min(depositTotal, FIRST_DEPOSIT_TARGET)
  const clampedMiningSessions = Math.min(miningSessions, MINING_SESSION_TARGET)

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
    },
  ]
}
