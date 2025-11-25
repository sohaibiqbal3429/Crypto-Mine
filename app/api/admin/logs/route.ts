import { type NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import Log from "@/models/Log"
import User from "@/models/User"

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
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") || "100")))
    const cursor = searchParams.get("cursor")
    const level = searchParams.get("level") || undefined
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const query = searchParams.get("q")?.trim()

    const filter: Record<string, unknown> = {}
    if (cursor) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) }
    }
    if (level && level !== "all") {
      filter.level = level
    }
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      }
    }
    if (query) {
      filter.message = { $regex: query, $options: "i" }
    }

    const docs = await Log.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()

    const hasMore = docs.length > limit
    const data = hasMore ? docs.slice(0, -1) : docs
    const nextCursor = hasMore ? String(data[data.length - 1]._id) : null

    return NextResponse.json({ data, nextCursor })
  } catch (error) {
    console.error("Admin logs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
