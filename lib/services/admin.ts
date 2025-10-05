// @ts-nocheck
import dbConnect from "@/lib/mongodb"
import User, { type IUser } from "@/models/User"
import Balance, { type IBalance } from "@/models/Balance"
import Transaction, { type ITransaction } from "@/models/Transaction"
import type {
  AdminInitialData,
  AdminSessionUser,
  AdminStats,
  AdminTransactionRecord,
  AdminUserRecord,
} from "@/lib/types/admin"

const toNumber = (value: unknown): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  const date = new Date(value || Date.now())
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export async function getAdminInitialData(adminId: string): Promise<AdminInitialData> {
  await dbConnect()

  const adminUserDoc = (await User.findById(adminId)
    .select("name email referralCode role")
    .lean()) as (IUser & { _id: any }) | null

  if (!adminUserDoc || adminUserDoc.role !== "admin") {
    throw new Error("Admin access required")
  }

  const [
    transactionDocsRaw,
    userDocsRaw,
    totalUsersCount,
    activeUsersCount,
    totalsAggregate,
    pendingDepositCount,
    pendingWithdrawalCount,
  ] = await Promise.all([
    Transaction.find({})
      .populate("userId", "name email referralCode")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    User.find({})
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    User.countDocuments({}),
    User.countDocuments({ isActive: true }),
    User.aggregate([
      {
        $group: {
          _id: null,
          totalDeposits: { $sum: "$depositTotal" },
          totalWithdrawals: { $sum: "$withdrawTotal" },
        },
      },
    ]),
    Transaction.countDocuments({ type: "deposit", status: "pending" }),
    Transaction.countDocuments({ type: "withdraw", status: "pending" }),
  ])

  const userDocs = userDocsRaw as Array<IUser & { _id: any }>
  const transactionDocs = transactionDocsRaw as Array<ITransaction & { userId?: IUser & { _id: any } }>
  const balanceDocs = (await Balance.find({ userId: { $in: userDocs.map((user) => user._id) } }).lean()) as Array<
    IBalance & { _id: any }
  >

  const balanceByUser = new Map<string, IBalance>()
  for (const balance of balanceDocs) {
    balanceByUser.set(balance.userId.toString(), balance)
  }

  const users: AdminUserRecord[] = userDocs.map((userDoc) => {
    const balanceDoc = balanceByUser.get(userDoc._id.toString())
    return {
      _id: userDoc._id.toString(),
      name: userDoc.name ?? "",
      email: userDoc.email ?? "",
      referralCode: userDoc.referralCode ?? "",
      role: userDoc.role ?? "user",
      level: toNumber(userDoc.level),
      depositTotal: toNumber(userDoc.depositTotal),
      withdrawTotal: toNumber(userDoc.withdrawTotal),
      roiEarnedTotal: toNumber(userDoc.roiEarnedTotal),
      isActive: Boolean(userDoc.isActive),
      createdAt: toIsoString(userDoc.createdAt),
      balance: {
        current: toNumber(balanceDoc?.current),
        totalBalance: toNumber(balanceDoc?.totalBalance),
        totalEarning: toNumber(balanceDoc?.totalEarning),
        lockedCapital: toNumber(balanceDoc?.lockedCapital),
        staked: toNumber(balanceDoc?.staked),
        pendingWithdraw: toNumber(balanceDoc?.pendingWithdraw),
      },
    }
  })

  const transactions: AdminTransactionRecord[] = transactionDocs.map((transactionDoc) => {
    const populatedUser = transactionDoc.userId
    return {
      _id: transactionDoc._id.toString(),
      userId: {
        _id: populatedUser?._id ? populatedUser._id.toString() : "",
        name: populatedUser?.name ?? "Unknown User",
        email: populatedUser?.email ?? "",
        referralCode: populatedUser?.referralCode ?? "",
      },
      type: transactionDoc.type ?? "unknown",
      amount: toNumber(transactionDoc.amount),
      status: transactionDoc.status ?? "pending",
      meta: (transactionDoc.meta as Record<string, unknown>) || {},
      createdAt: toIsoString(transactionDoc.createdAt),
    }
  })

  const aggregateTotals = (totalsAggregate[0] as { totalDeposits: number; totalWithdrawals: number } | undefined) ?? {
    totalDeposits: 0,
    totalWithdrawals: 0,
  }

  const stats: AdminStats = {
    totalUsers: totalUsersCount,
    activeUsers: activeUsersCount,
    pendingDeposits: pendingDepositCount,
    pendingWithdrawals: pendingWithdrawalCount,
    totalDeposits: aggregateTotals.totalDeposits,
    totalWithdrawals: aggregateTotals.totalWithdrawals,
  }

  const adminUser: AdminSessionUser = {
    name: adminUserDoc.name ?? "",
    email: adminUserDoc.email ?? "",
    referralCode: adminUserDoc.referralCode ?? "",
    role: adminUserDoc.role ?? "user",
  }

  return {
    adminUser,
    transactions,
    users,
    stats,
  }
}
