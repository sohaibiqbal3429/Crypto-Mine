import mongoose from "mongoose"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

function resolveAbsoluteUrl(url: string, origin: string): string {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) {
    return url
  }

  const normalized = url.startsWith("/") ? url : `/${url}`
  const withProxy = normalized.startsWith("/api/uploads/")
    ? normalized
    : normalized.startsWith("/uploads/")
      ? `/api/uploads${normalized}`
      : normalized
  return `${origin}${withProxy}`
}

function serializeTransaction(transaction: any, origin: string) {
  const meta = transaction.meta && typeof transaction.meta === "object" ? { ...transaction.meta } : {}
  if (meta.receipt && typeof meta.receipt === "object") {
    const receipt = { ...meta.receipt }
    if (typeof receipt.url === "string") {
      receipt.url = resolveAbsoluteUrl(receipt.url, origin)
    }
    meta.receipt = receipt
  }

  const populatedUser = transaction.userId && typeof transaction.userId === "object" ? transaction.userId : null

  return {
    _id: transaction._id?.toString?.() ?? "",
    userId: populatedUser
      ? {
          _id: populatedUser._id?.toString?.() ?? "",
          name: populatedUser.name ?? "",
          email: populatedUser.email ?? "",
          referralCode: populatedUser.referralCode ?? "",
        }
      : transaction.userId ?? null,
    type: transaction.type ?? "unknown",
    amount: Number(transaction.amount ?? 0),
    status: transaction.status ?? "pending",
    meta,
    createdAt:
      transaction.createdAt instanceof Date
        ? transaction.createdAt.toISOString()
        : new Date(transaction.createdAt ?? Date.now()).toISOString(),
  }
}

const TRANSACTION_PROJECTION = {
  meta: 1,
  amount: 1,
  status: 1,
  type: 1,
  createdAt: 1,
  userId: 1,
}

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(userPayload.userId)
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const typeParam = searchParams.get("type")
    const statusParam = searchParams.get("status") || undefined
    const userIdParam = searchParams.get("userId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const cursor = searchParams.get("cursor")
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") || "50")))
    const queryParam = searchParams.get("q")?.trim()

    const filter: Record<string, unknown> = {}
    if (cursor) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) }
    }
    if (typeParam && typeParam !== "all") {
      filter.type = typeParam
    }
    if (statusParam && statusParam !== "all") {
      filter.status = statusParam
    }
    if (userIdParam) {
      filter.userId = new mongoose.Types.ObjectId(userIdParam)
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

      const matchedUsers = await User.find({ email: { $regex: `^${queryParam}`, $options: "i" } })
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

    const transactions = await Transaction.find(filter, TRANSACTION_PROJECTION)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()

    const hasMore = transactions.length > limit
    const trimmed = hasMore ? transactions.slice(0, -1) : transactions
    const nextCursor = hasMore ? String(trimmed[trimmed.length - 1]._id) : null

    const userIds = trimmed
      .map((transaction) =>
        typeof transaction.userId === "string"
          ? transaction.userId
          : transaction.userId instanceof mongoose.Types.ObjectId
            ? transaction.userId.toString()
            : transaction.userId?._id?.toString?.() ?? "",
      )
      .filter((id): id is string => Boolean(id) && mongoose.Types.ObjectId.isValid(id))

    const uniqueUserIds = [...new Set(userIds)].map((id) => new mongoose.Types.ObjectId(id))

    const users = uniqueUserIds.length
      ? await User.find({ _id: { $in: uniqueUserIds } })
          .select({ name: 1, email: 1, referralCode: 1 })
          .lean()
      : []

    const usersById = new Map(users.map((user) => [user._id?.toString?.() ?? "", user]))
    const origin = new URL(request.url).origin

    const normalizedTransactions = trimmed.map((transaction) => {
      const userObject = usersById.get(transaction.userId?.toString?.() ?? "")
      return serializeTransaction({ ...transaction, userId: userObject || transaction.userId }, origin)
    })

    return NextResponse.json({ data: normalizedTransactions, nextCursor })
  } catch (error) {
    console.error("Admin transactions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
