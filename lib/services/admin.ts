// @ts-nocheck
import dbConnect from "@/lib/mongodb"
import Transaction from "@/models/Transaction"
import LuckyDrawDeposit from "@/models/LuckyDrawDeposit"
import User from "@/models/User"
import Settings from "@/models/Settings"
import type { AdminInitialData, AdminStats } from "@/lib/types/admin"
import { getDailyProfitPercentBounds, resolveDailyProfitPercent } from "@/lib/services/settings"
import { getWalletSettingsForAdmin } from "@/lib/services/app-settings"

const toNumber = (value: unknown): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export async function getAdminInitialData(adminId: string): Promise<AdminInitialData> {
  await dbConnect()

  const adminUserDoc = await User.findById(adminId)

  if (!adminUserDoc || adminUserDoc.role !== "admin") {
    throw new Error("Admin access required")
  }

  const settingsDoc = await Settings.findOne()
  const plainSettings = settingsDoc
    ? (typeof settingsDoc.toObject === "function" ? settingsDoc.toObject() : (settingsDoc as any))
    : null
  const activeDepositThreshold = plainSettings?.gating?.activeMinDeposit ?? 80
  const dailyProfitPercent = resolveDailyProfitPercent(plainSettings)
  const dailyProfitBounds = getDailyProfitPercentBounds()

  const [
    totalUsersResult,
    activeUsersResult,
    totalsAggregateResult,
    pendingDepositResult,
    pendingWithdrawalResult,
    pendingLuckyDrawResult,
  ] = await Promise.allSettled([
    User.estimatedDocumentCount().exec(),
    User.countDocuments({ depositTotal: { $gte: activeDepositThreshold } }).exec(),
    User.aggregate([
      {
        $group: {
          _id: null,
          totalDeposits: {
            $sum: {
              $convert: {
                input: "$depositTotal",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
          },
          totalWithdrawals: {
            $sum: {
              $convert: {
                input: "$withdrawTotal",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
      { $project: { _id: 0, totalDeposits: 1, totalWithdrawals: 1 } },
    ]).exec(),
    Transaction.countDocuments({ type: "deposit", status: "pending" }).exec(),
    Transaction.countDocuments({ type: "withdraw", status: "pending" }).exec(),
    LuckyDrawDeposit.countDocuments({ status: "PENDING" }).exec(),
  ])

  const readSettledValue = <T,>(result: PromiseSettledResult<T>, label: string, fallback: T): T => {
    if (result.status === "fulfilled") {
      return result.value
    }

    console.error(`[admin] Failed to load ${label}:`, result.reason)
    return fallback
  }

  const totalUsersCount = readSettledValue(totalUsersResult, "total user count", 0)
  const activeUsersCount = readSettledValue(activeUsersResult, "active user count", 0)
  const totalsAggregate = readSettledValue(totalsAggregateResult, "aggregate totals", [])
  const pendingDepositCount = readSettledValue(pendingDepositResult, "pending deposit count", 0)
  const pendingWithdrawalCount = readSettledValue(pendingWithdrawalResult, "pending withdrawal count", 0)
  const pendingLuckyDrawDeposits = readSettledValue(pendingLuckyDrawResult, "pending lucky draw deposits", 0)

  const stats: AdminStats = {
    totalUsers: totalUsersCount,
    activeUsers: activeUsersCount,
    pendingDeposits: pendingDepositCount,
    pendingWithdrawals: pendingWithdrawalCount,
    totalDeposits: toNumber(totalsAggregate?.[0]?.totalDeposits),
    totalWithdrawals: toNumber(totalsAggregate?.[0]?.totalWithdrawals),
    pendingLuckyDrawDeposits,
  }

  const walletSettings = await getWalletSettingsForAdmin()

  return {
    adminUser: {
      name: adminUserDoc.name ?? "",
      email: adminUserDoc.email ?? "",
      referralCode: adminUserDoc.referralCode ?? "",
      role: adminUserDoc.role ?? "user",
    },
    transactions: [],
    users: [],
    stats,
    settings: {
      dailyProfitPercent,
      bounds: dailyProfitBounds,
      wallets: walletSettings,
    },
  }
}
