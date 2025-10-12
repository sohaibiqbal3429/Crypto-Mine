import mongoose from "mongoose"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import Transaction from "@/models/Transaction"
import User from "@/models/User"
import type { LuckyDrawDeposit, DepositStatus } from "@/lib/types/lucky-draw"

const DEFAULT_LIMIT = 200

function mapStatus(status?: string | null): DepositStatus {
  switch (status) {
    case "approved":
      return "ACCEPTED"
    case "rejected":
      return "REJECTED"
    default:
      return "PENDING"
  }
}

function resolveAbsoluteUrl(url: string | undefined, origin: string): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) {
    return url
  }
  const normalized = url.startsWith("/") ? url : `/${url}`
  const proxied = normalized.startsWith("/api/uploads/")
    ? normalized
    : normalized.startsWith("/uploads/")
      ? `/api/uploads${normalized}`
      : normalized
  return `${origin}${proxied}`
}

function serializeDeposit(
  transaction: any,
  origin: string,
  userLookup: Map<string, { name?: string | null; email?: string | null }>,
): LuckyDrawDeposit {
  const userId = transaction.userId instanceof mongoose.Types.ObjectId ? transaction.userId.toString() : transaction.userId
  const userMeta = (userId && userLookup.get(userId)) || null
  const meta = transaction.meta && typeof transaction.meta === "object" ? transaction.meta : {}
  const receiptMeta = meta.receipt && typeof meta.receipt === "object" ? meta.receipt : null

  const receiptUrl = receiptMeta?.url ? resolveAbsoluteUrl(String(receiptMeta.url), origin) : undefined

  return {
    id: transaction._id?.toString?.() ?? "",
    txHash: meta.transactionHash || meta.transactionNumber || "",
    receiptReference:
      typeof receiptUrl === "string"
        ? receiptUrl
        : receiptMeta?.originalName || meta.transactionHash || meta.transactionNumber || "",
    submittedAt:
      transaction.createdAt instanceof Date
        ? transaction.createdAt.toISOString()
        : new Date(transaction.createdAt ?? Date.now()).toISOString(),
    status: mapStatus(transaction.status),
    amountUsd: Number(transaction.amount ?? 0),
    network: meta.depositNetwork || meta.depositNetworkId || undefined,
    depositAddress: meta.depositWalletAddress || undefined,
    exchangePlatform: meta.exchangePlatform ?? null,
    receipt: receiptMeta
      ? {
          url: receiptUrl,
          originalName: receiptMeta.originalName,
          mimeType: receiptMeta.mimeType,
          size: typeof receiptMeta.size === "number" ? receiptMeta.size : undefined,
          uploadedAt: receiptMeta.uploadedAt,
          checksum: receiptMeta.checksum,
        }
      : null,
    userId: userId || undefined,
    userName: userMeta?.name || undefined,
    userEmail: userMeta?.email || undefined,
  }
}

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(userPayload.userId).select({ role: 1 }).lean()
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get("status")?.toLowerCase()
    const limit = Math.min(
      DEFAULT_LIMIT,
      Math.max(1, Number.parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    )

    const query: Record<string, unknown> = { type: "deposit" }
    if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
      query.status = statusFilter
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    const userIds = transactions
      .map((transaction) =>
        transaction.userId instanceof mongoose.Types.ObjectId
          ? transaction.userId.toString()
          : typeof transaction.userId === "string"
            ? transaction.userId
            : "",
      )
      .filter((id): id is string => Boolean(id) && mongoose.Types.ObjectId.isValid(id))

    const uniqueUserIds = [...new Set(userIds)]

    const users = uniqueUserIds.length
      ? await User.find({ _id: { $in: uniqueUserIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .select({ name: 1, email: 1 })
          .lean()
      : []

    const usersById = new Map(users.map((user) => [user._id?.toString?.() ?? "", { name: user.name, email: user.email }]))
    const origin = new URL(request.url).origin

    const deposits = transactions.map((transaction) => serializeDeposit(transaction, origin, usersById))

    return NextResponse.json({ deposits })
  } catch (error) {
    console.error("Admin lucky draw deposits error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
