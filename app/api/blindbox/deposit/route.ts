import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { BlindBoxServiceError, submitBlindBoxDeposit } from "@/lib/services/blindbox"

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    if (!payload || typeof payload.txId !== "string") {
      return NextResponse.json({ error: "Transaction hash is required" }, { status: 400 })
    }

    const deposit = await submitBlindBoxDeposit({ userId: user.userId, txId: payload.txId })

    return NextResponse.json({
      deposit: {
        id: deposit._id.toString(),
        status: deposit.status,
        txId: deposit.txId,
        amount: deposit.amount,
        createdAt: deposit.createdAt.toISOString(),
      },
    })
  } catch (error: any) {
    if (error instanceof BlindBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Blind box deposit submission error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
