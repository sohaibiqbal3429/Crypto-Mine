import { type NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"
import User from "@/models/User"
import Settings, { type ISettings } from "@/models/Settings"

function toObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid user id")
  }
  return new mongoose.Types.ObjectId(id)
}

async function requireAdmin(request: NextRequest) {
  const session = getUserFromRequest(request)
  if (!session) return null
  await dbConnect()
  const user = await User.findById(session.userId)
  if (!user || user.role !== "admin") return null
  return user
}

function parsePercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "string" ? Number.parseFloat(value) : Number(value)
  if (!Number.isFinite(n)) return null
  return Number(n.toFixed(2))
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = toObjectId(params.id)
    const [user, settingsDoc] = await Promise.all([User.findById(userId).lean(), Settings.findOne().lean()])
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const settings: Partial<ISettings> | null = settingsDoc as any
    const defaultRateRaw: any = settings?.dailyProfitPercent ?? settings?.mining?.minPct ?? 1.5
    const defaultRate = Number.isFinite(Number(defaultRateRaw))
      ? Number(Number(defaultRateRaw).toFixed(2))
      : 1.5

    const override = typeof (user as any).miningDailyRateOverridePct === "number" ? (user as any).miningDailyRateOverridePct : null
    return NextResponse.json({ override, defaultRate })
  } catch (error) {
    console.error("Failed to load user mining rate override", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = toObjectId(params.id)

    let payload: any
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const value = parsePercent(payload?.percent ?? payload?.value)
    if (value !== null && (value < 0 || value > 100)) {
      return NextResponse.json({ error: "Percent must be between 0 and 100" }, { status: 422 })
    }

    const update = value === null ? { $unset: { miningDailyRateOverridePct: "" } } : { $set: { miningDailyRateOverridePct: value } }
    await dbConnect()
    const result = await User.updateOne({ _id: userId }, update)
    if (!result.acknowledged) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 })
    }

    return NextResponse.json({ override: value })
  } catch (error) {
    console.error("Failed to update user mining rate override", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

