import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { fetchWalletContext } from "@/lib/services/wallet"

export async function GET(request: NextRequest) {
  try {
    const session = getUserFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const context = await fetchWalletContext(session.userId)
    if (!context) {
      return NextResponse.json({ error: "Wallet context not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, context })
  } catch (error) {
    console.error("Wallet context error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
