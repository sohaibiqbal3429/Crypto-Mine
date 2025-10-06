import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Transaction from "@/models/Transaction"
import { getUserFromRequest } from "@/lib/auth"

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
    const statusParam = searchParams.get("status")
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20")))

    // Build query
    const query: any = {}
    if (typeParam && typeParam !== "all") query.type = typeParam
    if (statusParam && statusParam !== "all") query.status = statusParam

    // Get transactions with user data
    const transactions = await Transaction.find(query)
      .populate("userId", "name email referralCode")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    const total = await Transaction.countDocuments(query)

    const origin = new URL(request.url).origin
    const normalizedTransactions = transactions.map((transaction) => serializeTransaction(transaction, origin))

    return NextResponse.json({
      transactions: normalizedTransactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Admin transactions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
