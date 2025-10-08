import mongoose from "mongoose"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import Transaction from "@/models/Transaction"

const PROJECTION = {
  bigBlob: 0,
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
    const status = searchParams.get("status") || undefined
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const cursor = searchParams.get("cursor")
    const limit = Math.min(Number(searchParams.get("limit") || "20"), 200)
    const queryParam = searchParams.get("q")?.trim()

    const filter: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userPayload.userId) }

    if (cursor) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) }
    }
    if (type && type !== "all") {
      filter.type = type
    }
    if (status && status !== "all") {
      filter.status = status
    }
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      }
    }
    if (queryParam) {
      const or: Record<string, unknown>[] = []
      if (/^[a-f0-9]{24}$/i.test(queryParam)) {
        or.push({ _id: new mongoose.Types.ObjectId(queryParam) })
      }
      or.push({ userEmail: { $regex: `^${queryParam}`, $options: "i" } })
      filter.$or = or
    }

    const docs = await Transaction.find(filter, PROJECTION)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()

    const hasMore = docs.length > limit
    const data = hasMore ? docs.slice(0, -1) : docs
    const nextCursor = hasMore ? String(data[data.length - 1]._id) : null

    const baseMatch: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userPayload.userId),
    }
    if (status && status !== "all") {
      baseMatch.status = status
    }
    if (type && type !== "all") {
      baseMatch.type = type
    }
    if (from || to) {
      baseMatch.createdAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      }
    }

    const summary = await Transaction.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: { type: "$type", status: "$status" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, type: "$_id.type", status: "$_id.status", total: 1, count: 1 } },
    ]).exec()

    const summaryMap = summary.reduce<Record<string, Record<string, { total: number; count: number }>>>(
      (acc, item) => {
        const typeKey = item.type ?? "unknown"
        if (!acc[typeKey]) acc[typeKey] = {}
        acc[typeKey][item.status ?? "unknown"] = { total: item.total ?? 0, count: item.count ?? 0 }
        return acc
      },
      {},
    )

    const balanceChanges = await Transaction.aggregate([
      { $match: { ...baseMatch, status: "approved" } },
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

    return NextResponse.json({
      success: true,
      data,
      nextCursor,
      summary: summaryMap,
      balanceChanges: balanceChanges[0] || {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalEarnings: 0,
        totalCommissions: 0,
      },
    })
  } catch (error) {
    console.error("Transactions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
