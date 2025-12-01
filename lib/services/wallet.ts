import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Settings from "@/models/Settings"
import { calculateWithdrawableSnapshot } from "@/lib/utils/locked-capital"
import { ACTIVE_DEPOSIT_THRESHOLD } from "@/lib/constants/bonuses"

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
    earningsBalance: number
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

  // Always derive Active from lifetime deposits per the source-of-truth rule.
  const lifetimeDeposits = Number(userDoc.depositTotal ?? 0)
  const isActiveByRule = lifetimeDeposits >= ACTIVE_DEPOSIT_THRESHOLD

  const stats = {
    // Show what is actually withdrawable in the "Current Balance" stat card
    currentBalance: Number(withdrawableSnapshot.withdrawable ?? 0),
    totalBalance: Number(balanceDoc?.totalBalance ?? 0),
    totalEarning: Number(balanceDoc?.totalEarning ?? 0),
    earningsBalance: Number(balanceDoc?.totalEarning ?? 0),
    pendingWithdraw: Number(
      withdrawableSnapshot.pendingWithdraw ?? balanceDoc?.pendingWithdraw ?? 0,
    ),
    staked: Number(balanceDoc?.staked ?? 0),
    // Wallet balance = real-time current (includes locked) for display
    walletBalance: Number(withdrawableSnapshot.current ?? balanceDoc?.current ?? 0),
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
      isActive: isActiveByRule, // <- derived from deposits ≥ $80
      depositTotal: lifetimeDeposits,
    },
    stats,
    minDeposit,
    withdrawConfig,
    withdrawable: {
      amount: Number(withdrawableSnapshot.withdrawable ?? 0),
      pendingWithdraw: Number(
        withdrawableSnapshot.pendingWithdraw ?? balanceDoc?.pendingWithdraw ?? 0,
      ),
    },
  }
}
