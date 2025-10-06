import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getLuckyDrawConfig, LuckyDrawServiceError, updateLuckyDrawSettings } from "@/lib/services/lucky-draw"
import User from "@/models/User"

async function requireAdmin(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return null
  }

  const adminUser = await User.findById(payload.userId).select("role")
  if (!adminUser || adminUser.role !== "admin") {
    return null
  }

  return payload
}

export async function GET(request: NextRequest) {
  try {
    const payload = await requireAdmin(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const config = await getLuckyDrawConfig()
    return NextResponse.json({ config })
  } catch (error: any) {
    if (error instanceof LuckyDrawServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin lucky draw settings fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await requireAdmin(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const nextConfig = await updateLuckyDrawSettings({
      entryFee: typeof body?.entryFee === "number" ? body.entryFee : undefined,
      prize: typeof body?.prize === "number" ? body.prize : undefined,
      cycleHours: typeof body?.cycleHours === "number" ? body.cycleHours : undefined,
      autoDrawEnabled:
        typeof body?.autoDrawEnabled === "boolean" ? body.autoDrawEnabled : undefined,
    })

    return NextResponse.json({ config: nextConfig })
  } catch (error: any) {
    if (error instanceof LuckyDrawServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin lucky draw settings update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
