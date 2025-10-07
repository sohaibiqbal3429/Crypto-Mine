import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { BlindBoxServiceError, getBlindBoxConfig, updateBlindBoxSettings } from "@/lib/services/blindbox"
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

    const config = await getBlindBoxConfig()

    return NextResponse.json({ config })
  } catch (error: any) {
    if (error instanceof BlindBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin blind box settings fetch error:", error)
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
    const nextConfig = await updateBlindBoxSettings({
      depositAmount: typeof body.depositAmount === "number" ? body.depositAmount : undefined,
      rewardAmount: typeof body.rewardAmount === "number" ? body.rewardAmount : undefined,
      cycleHours: typeof body.cycleHours === "number" ? body.cycleHours : undefined,
      autoDrawEnabled: typeof body.autoDrawEnabled === "boolean" ? body.autoDrawEnabled : undefined,
    })

    return NextResponse.json({ config: nextConfig })
  } catch (error: any) {
    if (error instanceof BlindBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin blind box settings update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
