import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { BlindBoxServiceError, listBlindBoxDeposits } from "@/lib/services/blindbox"
import User from "@/models/User"

export async function GET(request: NextRequest) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(payload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get("status")

    const deposits = await listBlindBoxDeposits(
      statusParam === "pending" || statusParam === "approved" || statusParam === "rejected"
        ? (statusParam as any)
        : undefined,
    )

    const normalized = deposits.map((deposit) => ({
      id: deposit._id.toString(),
      status: deposit.status,
      txId: deposit.txId,
      amount: deposit.amount,
      network: deposit.network,
      address: deposit.address,
      createdAt: deposit.createdAt.toISOString(),
      user:
        deposit.userId && typeof deposit.userId === "object" && "_id" in deposit.userId
          ? {
              id: (deposit.userId as any)._id.toString(),
              name: (deposit.userId as any).name ?? "",
              email: (deposit.userId as any).email ?? "",
              referralCode: (deposit.userId as any).referralCode ?? "",
            }
          : null,
    }))

    return NextResponse.json({ deposits: normalized })
  } catch (error: any) {
    if (error instanceof BlindBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin blind box deposits error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
