import { type NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import Transaction from "@/models/Transaction"
import User from "@/models/User"
import type { LuckyDrawDeposit, DepositStatus } from "@/lib/types/lucky-draw"

const DEFAULT_LIMIT = 50

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

function serializeDeposit(transaction: any, origin: string, user: { name?: string | null; email?: string | null } | null): LuckyDrawDeposit {
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
    userId: transaction.userId instanceof mongoose.Types.ObjectId ? transaction.userId.toString() : undefined,
    userName: user?.name || undefined,
    userEmail: user?.email || undefined,
  }
}

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const userId = new mongoose.Types.ObjectId(userPayload.userId)

    const [transactions, user] = await Promise.all([
      Transaction.find({ userId, type: "deposit" })
        .sort({ createdAt: -1 })
        .limit(DEFAULT_LIMIT)
        .lean(),
      User.findById(userId).select({ name: 1, email: 1 }).lean(),
    ])

    const origin = new URL(request.url).origin
    const deposits = transactions.map((transaction) => serializeDeposit(transaction, origin, user))

    return NextResponse.json({ deposits })
  } catch (error) {
    console.error("User lucky draw deposits error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
