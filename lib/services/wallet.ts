import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Settings from "@/models/Settings"

export interface WalletContext {
  user: {
    name: string
    email: string
    referralCode: string
    role: string
  }
  stats: {
    currentBalance: number
    totalBalance: number
    totalEarning: number
    pendingWithdraw: number
    staked: number
  }
  minDeposit: number
  withdrawConfig: {
    minWithdraw: number
  }
}

export async function fetchWalletContext(userId: string): Promise<WalletContext | null> {
  await dbConnect()

  const [userDoc, balanceDoc, settingsDoc] = await Promise.all([
    User.findById(userId).lean(),
    Balance.findOne({ userId }).lean(),
    Settings.findOne().lean(),
  ])

  if (!userDoc) return null

  const teamRewardsAvailable = Number(balanceDoc?.teamRewardsAvailable ?? 0)

  const stats = {
    currentBalance: Number(balanceDoc?.current ?? 0) + teamRewardsAvailable,
    totalBalance: Number(balanceDoc?.totalBalance ?? 0) + teamRewardsAvailable,
    totalEarning: Number(balanceDoc?.totalEarning ?? 0),
    pendingWithdraw: Number(balanceDoc?.pendingWithdraw ?? 0),
    staked: Number(balanceDoc?.staked ?? 0),
  }

  const minDeposit = Number(settingsDoc?.gating?.minDeposit ?? 30)
  const withdrawConfig = {
    minWithdraw: Number(settingsDoc?.gating?.minWithdraw ?? 30),
  }

  return {
    user: {
      name: userDoc.name,
      email: userDoc.email,
      referralCode: userDoc.referralCode,
      role: userDoc.role,
    },
    stats,
    minDeposit,
    withdrawConfig,
  }
}
