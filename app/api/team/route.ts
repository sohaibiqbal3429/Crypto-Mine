import { NextResponse, type NextRequest } from "next/server"
import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"
import User from "@/models/User"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const MIN_LIMIT = 10

function parsePagination(searchParams: URLSearchParams) {
  const rawPage = Number(searchParams.get("page") ?? 1)
  const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT)

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
  const limitCandidate = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : DEFAULT_LIMIT
  const limit = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, limitCandidate))

  return { page, limit }
}

export async function GET(request: NextRequest) {
  try {
    const payload = getUserFromRequest(request)

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get("userId") ?? payload.userId

    if (!targetUserId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
    }

    const { page, limit } = parsePagination(searchParams)
    const skip = (page - 1) * limit

    await dbConnect()

    const filter = { referredBy: new mongoose.Types.ObjectId(targetUserId) }

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("name level qualified depositTotal referredBy createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ])

    const hasMore = skip + items.length < total

    return NextResponse.json(
      {
        items,
        page,
        limit,
        total,
        hasMore,
      },
      {
        headers: {
          "cache-control": "private, max-age=30",
        },
      },
    )
  } catch (error) {
    console.error("Failed to load team members", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
