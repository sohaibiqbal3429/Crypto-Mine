import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { getGiftBoxSettings } from "@/lib/services/giftbox"
import Settings from "@/models/Settings"
import User from "@/models/User"

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()
    const adminDoc = await User.findById(user.userId).select({ role: 1 }).lean()
    if (!adminDoc || adminDoc.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settings = await getGiftBoxSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Giftbox settings fetch error", error)
    return NextResponse.json({ error: "Unable to fetch settings" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()
    const adminDoc = await User.findById(user.userId).select({ role: 1 }).lean()
    if (!adminDoc || adminDoc.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await request.json().catch(() => ({}))
    const update: any = {}

    if (payload.roundDurationHours !== undefined) update["blindBox.roundDurationHours"] = Number(payload.roundDurationHours)
    if (payload.minDeposit !== undefined) update["blindBox.minDeposit"] = Number(payload.minDeposit)
    if (payload.entryValue !== undefined) update["blindBox.entryValue"] = Number(payload.entryValue)
    if (payload.allowMultiples !== undefined) update["blindBox.allowMultiples"] = Boolean(payload.allowMultiples)
    if (payload.prizePoolPercent !== undefined) update["blindBox.prizePoolPercent"] = Number(payload.prizePoolPercent)
    if (payload.network !== undefined) update["blindBox.network"] = String(payload.network)
    if (payload.address !== undefined) update["blindBox.address"] = String(payload.address)

    if (!Object.keys(update).length) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 })
    }

    await Settings.updateOne({}, { $set: update }, { upsert: true })

    const settings = await getGiftBoxSettings()

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("Giftbox settings update error", error)
    const message = error instanceof Error ? error.message : "Unable to update settings"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
