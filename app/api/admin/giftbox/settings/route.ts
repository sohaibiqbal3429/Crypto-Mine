import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { GiftBoxServiceError, getGiftBoxConfig, updateGiftBoxSettings } from "@/lib/services/giftbox"
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

    const config = await getGiftBoxConfig()

    return NextResponse.json({ config })
  } catch (error: any) {
    if (error instanceof GiftBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin gift box settings fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(payload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const nextConfig = await updateGiftBoxSettings({
      ticketPrice: typeof body.ticketPrice === "number" ? body.ticketPrice : undefined,
      payoutPercentage: typeof body.payoutPercentage === "number" ? body.payoutPercentage : undefined,
      cycleHours: typeof body.cycleHours === "number" ? body.cycleHours : undefined,
      winnersCount: typeof body.winnersCount === "number" ? body.winnersCount : undefined,
      autoDrawEnabled: typeof body.autoDrawEnabled === "boolean" ? body.autoDrawEnabled : undefined,
      refundPercentage: typeof body.refundPercentage === "number" ? body.refundPercentage : undefined,
      depositAddress: typeof body.depositAddress === "string" ? body.depositAddress : undefined,
    })

    return NextResponse.json({ config: nextConfig })
  } catch (error: any) {
    if (error instanceof GiftBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin gift box settings update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
