import mongoose from "mongoose"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import Payout from "@/models/Payout"
import User from "@/models/User"

const PROJECTION = {
  meta: 1,
  amount: 1,
  status: 1,
  type: 1,
  userId: 1,
  sourceId: 1,
  date: 1,
  uniqueKey: 1,
  createdAt: 1,
}

export async function GET(request: NextRequest) {
  try {
    const session = getUserFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(session.userId).lean()
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") || "50")))
    const cursor = searchParams.get("cursor")
    const status = searchParams.get("status") || undefined
    const userId = searchParams.get("userId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const query = searchParams.get("q")?.trim()

    const filter: Record<string, unknown> = {}
    if (cursor) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) }
    }
    if (status && status !== "all") {
      filter.status = status
    }
    if (userId) {
      filter.userId = new mongoose.Types.ObjectId(userId)
    }
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      }
    }
    if (query) {
      const or: Record<string, unknown>[] = []
      if (/^[a-f0-9]{24}$/i.test(query)) {
        or.push({ _id: new mongoose.Types.ObjectId(query) })
      }

      const matchedUsers = await User.find({ email: { $regex: `^${query}`, $options: "i" } })
        .select({ _id: 1 })
        .limit(50)
        .lean()

      if (matchedUsers.length) {
        or.push({ userId: { $in: matchedUsers.map((user) => user._id) } })
      }

      if (or.length) {
        filter.$or = or
      }
    }

    const docs = await Payout.find(filter, PROJECTION)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()

    const hasMore = docs.length > limit
    const data = hasMore ? docs.slice(0, -1) : docs
    const nextCursor = hasMore ? String(data[data.length - 1]._id) : null

    return NextResponse.json({ data, nextCursor })
  } catch (error) {
    console.error("Admin payouts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
