// @ts-nocheck
import dbConnect from "@/lib/mongodb"
import Transaction from "@/models/Transaction"
import LuckyDrawDeposit from "@/models/LuckyDrawDeposit"
import User from "@/models/User"
import Settings from "@/models/Settings"
import type { AdminInitialData, AdminStats } from "@/lib/types/admin"

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

  const settingsDoc = await Settings.findOne().select({ "gating.activeMinDeposit": 1 }).lean()
  const activeDepositThreshold = settingsDoc?.gating?.activeMinDeposit ?? 80

  const [
    totalUsersCount,
    activeUsersCount,
    totalsAggregate,
    pendingDepositCount,
    pendingWithdrawalCount,
    pendingLuckyDrawDeposits,
  ] = await Promise.all([
    User.estimatedDocumentCount().exec(),
    User.countDocuments({ depositTotal: { $gte: activeDepositThreshold } }).exec(),
    User.aggregate([
      {
        $group: {
          _id: null,
          totalDeposits: { $sum: "$depositTotal" },
          totalWithdrawals: { $sum: "$withdrawTotal" },
        },
      },
      { $project: { _id: 0, totalDeposits: 1, totalWithdrawals: 1 } },
    ]).exec(),
    Transaction.countDocuments({ type: "deposit", status: "pending" }).exec(),
    Transaction.countDocuments({ type: "withdraw", status: "pending" }).exec(),
    LuckyDrawDeposit.countDocuments({ status: "PENDING" }).exec(),
  ])

  const stats: AdminStats = {
    totalUsers: totalUsersCount,
    activeUsers: activeUsersCount,
    pendingDeposits: pendingDepositCount,
    pendingWithdrawals: pendingWithdrawalCount,
    totalDeposits: toNumber(totalsAggregate?.[0]?.totalDeposits),
    totalWithdrawals: toNumber(totalsAggregate?.[0]?.totalWithdrawals),
    pendingLuckyDrawDeposits,
  }

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
  }
}
