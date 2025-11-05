import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Settings from "@/models/Settings"
import { calculateWithdrawableSnapshot } from "@/lib/utils/locked-capital"

export interface WalletContext {
  user: {
    name: string
    email: string
    referralCode: string
    role: string
    profileAvatar: string
    isActive: boolean
    depositTotal: number
  }
  stats: {
    currentBalance: number
    totalBalance: number
    totalEarning: number
    pendingWithdraw: number
    staked: number
    walletBalance: number
  }
  minDeposit: number
  withdrawConfig: {
    minWithdraw: number
  }
  withdrawable: {
    amount: number
    pendingWithdraw: number
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

  const withdrawableSnapshot = balanceDoc
    ? calculateWithdrawableSnapshot(balanceDoc, new Date())
    : {
        asOf: new Date(),
        current: 0,
        lockedAmount: 0,
        lockedAmountFromLots: 0,
        lockedCapitalField: 0,
        pendingWithdraw: 0,
        withdrawable: 0,
        withdrawableCents: 0,
        lockedAmountCents: 0,
        currentCents: 0,
        nextUnlockAt: null,
        activeLockedLots: [],
      }

  const stats = {
    currentBalance: withdrawableSnapshot.withdrawable ?? 0,
    totalBalance: Number(balanceDoc?.totalBalance ?? 0),
    totalEarning: Number(balanceDoc?.totalEarning ?? 0),
    pendingWithdraw: withdrawableSnapshot.pendingWithdraw ?? Number(balanceDoc?.pendingWithdraw ?? 0),
    staked: Number(balanceDoc?.staked ?? 0),
    walletBalance: withdrawableSnapshot.current ?? Number(balanceDoc?.current ?? 0),
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
      profileAvatar: userDoc.profileAvatar ?? "avatar-01",
      isActive: Boolean(userDoc.isActive),
      depositTotal: Number(userDoc.depositTotal ?? 0),
    },
    stats,
    minDeposit,
    withdrawConfig,
    withdrawable: {
      amount: withdrawableSnapshot.withdrawable ?? 0,
      pendingWithdraw: withdrawableSnapshot.pendingWithdraw ?? Number(balanceDoc?.pendingWithdraw ?? 0),
    },
  }
}
