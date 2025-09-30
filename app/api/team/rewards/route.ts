import { type NextRequest, NextResponse } from "next/server"

import dbConnect from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const balance = await Balance.findOne({ userId: userPayload.userId })
    if (!balance) {
      return NextResponse.json({ error: "Balance not found" }, { status: 404 })
    }

    return NextResponse.json({
      available: balance.teamRewardsAvailable ?? 0,
      claimedTotal: balance.teamRewardsClaimed ?? 0,
      lastClaimedAt: balance.teamRewardsLastClaimedAt
        ? balance.teamRewardsLastClaimedAt.toISOString()
        : null,
    })
  } catch (error) {
    console.error("Team rewards fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const balance = await Balance.findOne({ userId: userPayload.userId })
    if (!balance) {
      return NextResponse.json({ error: "Balance not found" }, { status: 404 })
    }

    const available = balance.teamRewardsAvailable || 0
    if (available <= 0) {
      return NextResponse.json({ error: "No team rewards available to claim" }, { status: 400 })
    }

    const claimDate = new Date()

    balance.current += available
    balance.totalBalance += available
    balance.totalEarning += available
    balance.teamRewardsClaimed += available
    balance.teamRewardsAvailable = 0
    balance.teamRewardsLastClaimedAt = claimDate

    await balance.save()

    await Transaction.create({
      userId: userPayload.userId,
      type: "teamReward",
      amount: available,
      meta: {
        source: "team_rewards",
        claimedAt: claimDate.toISOString(),
      },
      status: "approved",
    })

    await Notification.create({
      userId: userPayload.userId,
      kind: "team-reward-claimed",
      title: "Team rewards claimed",
      body: `You claimed $${available.toFixed(2)} in team rewards.`,
    })

    return NextResponse.json({
      success: true,
      available: balance.teamRewardsAvailable,
      claimedTotal: balance.teamRewardsClaimed,
      lastClaimedAt: balance.teamRewardsLastClaimedAt?.toISOString() ?? null,
      creditedAmount: available,
    })
  } catch (error) {
    console.error("Team rewards claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
