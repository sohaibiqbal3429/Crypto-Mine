import mongoose from "mongoose"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import Transaction from "@/models/Transaction"

const PROJECTION = {
  bigBlob: 0,
}

interface TransactionSummaryEntry {
  total: number
  count: number
  statuses?: Record<string, { total: number; count: number }>
}

interface SanitizedTransaction {
  _id: string
  type: string
  amount: number
  status: string
  meta: any
  createdAt: string
}

function toNumeric(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "bigint") {
    return Number(value)
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (value && typeof value === "object") {
    const candidate = (value as { valueOf?: () => unknown }).valueOf?.()

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate
    }

    if (typeof candidate === "string") {
      const parsed = Number(candidate)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }

    const stringified = (value as { toString?: () => string }).toString?.()
    if (typeof stringified === "string") {
      const parsed = Number(stringified)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return 0
}

function sanitizeTransactions(transactions: any[]): SanitizedTransaction[] {
  return transactions.map((transaction) => ({
    _id: String(transaction._id),
    type: transaction.type,
    amount: toNumeric(transaction.amount),
    status: transaction.status ?? "pending",
    meta: transaction.meta ?? null,
    createdAt:
      transaction.createdAt instanceof Date
        ? transaction.createdAt.toISOString()
        : new Date(transaction.createdAt ?? Date.now()).toISOString(),
  }))
}

function buildSummaryMap(raw: Array<{ type?: string | null; status?: string | null; total?: number; count?: number }>) {
  return raw.reduce<Record<string, TransactionSummaryEntry>>((acc, item) => {
    const typeKey = item.type ?? "unknown"
    const statusKey = item.status ?? "unknown"
    const total = toNumeric(item.total)
    const count = toNumeric(item.count)

    if (!acc[typeKey]) {
      acc[typeKey] = { total: 0, count: 0, statuses: {} }
    }

    acc[typeKey].total += total
    acc[typeKey].count += count

    if (!acc[typeKey].statuses) {
      acc[typeKey].statuses = {}
    }

    acc[typeKey].statuses![statusKey] = {
      total,
      count,
    }

    return acc
  }, {})
}

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "20", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 20
  return Math.min(parsed, 200)
}

function buildDateRange(from?: string | null, to?: string | null) {
  if (!from && !to) return undefined

  const range: Record<string, Date> = {}
  if (from) {
    const parsedFrom = new Date(from)
    if (!Number.isNaN(parsedFrom.getTime())) {
      range.$gte = parsedFrom
    }
  }
  if (to) {
    const parsedTo = new Date(to)
    if (!Number.isNaN(parsedTo.getTime())) {
      range.$lte = parsedTo
    }
  }

  return Object.keys(range).length > 0 ? range : undefined
}

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const status = searchParams.get("status")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const cursor = searchParams.get("cursor")
    const limit = normalizeLimit(searchParams.get("limit"))
    const queryParam = searchParams.get("q")?.trim()

    const userObjectId = new mongoose.Types.ObjectId(userPayload.userId)

    const filter: Record<string, unknown> = { userId: userObjectId }

    if (cursor && /^[a-f0-9]{24}$/i.test(cursor)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) }
    }
    if (type && type !== "all") {
      filter.type = type
    }
    if (status && status !== "all") {
      filter.status = status
    }

    const dateRange = buildDateRange(from, to)
    if (dateRange) {
      filter.createdAt = dateRange
    }

    if (queryParam) {
      const or: Record<string, unknown>[] = []
      if (/^[a-f0-9]{24}$/i.test(queryParam)) {
        or.push({ _id: new mongoose.Types.ObjectId(queryParam) })
      }
      or.push({ userEmail: { $regex: `^${queryParam}`, $options: "i" } })
      filter.$or = or
    }

    const transactionsPromise = Transaction.find(filter, PROJECTION)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()

    const summaryMatch: Record<string, unknown> = { userId: userObjectId }
    if (type && type !== "all") {
      summaryMatch.type = type
    }
    if (status && status !== "all") {
      summaryMatch.status = status
    }
    if (dateRange) {
      summaryMatch.createdAt = dateRange
    }
    if (queryParam) {
      const summaryOr: Record<string, unknown>[] = []
      if (/^[a-f0-9]{24}$/i.test(queryParam)) {
        summaryOr.push({ _id: new mongoose.Types.ObjectId(queryParam) })
      }
      summaryOr.push({ userEmail: { $regex: `^${queryParam}`, $options: "i" } })
      summaryMatch.$or = summaryOr
    }

    const summaryPromise = Transaction.aggregate([
      { $match: summaryMatch },
      {
        $group: {
          _id: { type: "$type", status: "$status" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, type: "$_id.type", status: "$_id.status", total: 1, count: 1 } },
    ]).exec()

    const balanceMatch: Record<string, unknown> = { userId: userObjectId, status: "approved" }
    if (type && type !== "all") {
      balanceMatch.type = type
    }
    if (dateRange) {
      balanceMatch.createdAt = dateRange
    }

    const balancePromise = Transaction.aggregate([
      { $match: balanceMatch },
      {
        $group: {
          _id: null,
          totalDeposits: {
            $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] },
          },
          totalWithdrawals: {
            $sum: { $cond: [{ $eq: ["$type", "withdraw"] }, "$amount", 0] },
          },
          totalEarnings: {
            $sum: { $cond: [{ $eq: ["$type", "earn"] }, "$amount", 0] },
          },
          totalCommissions: {
            $sum: { $cond: [{ $eq: ["$type", "commission"] }, "$amount", 0] },
          },
        },
      },
      { $project: { _id: 0 } },
    ]).exec()

    const [transactions, summary, balanceChanges] = await Promise.all([
      transactionsPromise,
      summaryPromise,
      balancePromise,
    ])

    const hasMore = transactions.length > limit
    const slicedTransactions = hasMore ? transactions.slice(0, -1) : transactions
    const nextCursor = hasMore ? String(slicedTransactions[slicedTransactions.length - 1]._id) : null

    const sanitizedTransactions = sanitizeTransactions(slicedTransactions)
    const summaryMap = buildSummaryMap(summary)

    const normalizedBalance = {
      totalDeposits: Number(balanceChanges[0]?.totalDeposits ?? 0),
      totalWithdrawals: Number(balanceChanges[0]?.totalWithdrawals ?? 0),
      totalEarnings: Number(balanceChanges[0]?.totalEarnings ?? 0),
      totalCommissions: Number(balanceChanges[0]?.totalCommissions ?? 0),
    }

    return NextResponse.json({
      success: true,
      transactions: sanitizedTransactions,
      data: sanitizedTransactions,
      nextCursor,
      hasMore,
      summary: Object.fromEntries(
        Object.entries(summaryMap).map(([typeKey, value]) => [typeKey, { total: value.total, count: value.count }]),
      ),
      summaryBreakdown: summaryMap,
      balanceChanges: normalizedBalance,
    })
  } catch (error) {
    console.error("Transactions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
