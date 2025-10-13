import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getCurrentRoundOverview } from "@/lib/services/giftbox"

export const revalidate = 0

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request as any)
    const overview = await getCurrentRoundOverview(user?.userId)
    return NextResponse.json({ round: overview })
  } catch (error) {
    console.error("Failed to load giftbox round", error)
    return NextResponse.json({ error: "Unable to load round" }, { status: 500 })
  }
}
