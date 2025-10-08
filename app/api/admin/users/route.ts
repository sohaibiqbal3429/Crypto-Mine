import mongoose from "mongoose"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import Balance from "@/models/Balance"
import LevelHistory from "@/models/LevelHistory"
import User from "@/models/User"
import dbConnect from "@/lib/mongodb"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(userPayload.userId)
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") || "100")))
    const cursor = searchParams.get("cursor")
    const status = searchParams.get("status") || undefined
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const queryParam = searchParams.get("q")?.trim()

    const filter: Record<string, unknown> = {}

    if (cursor) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) }
    }
    if (status && status !== "all") {
      filter.status = status
    }
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      }
    }
    if (queryParam) {
      filter.$or = [
        { email: { $regex: `^${queryParam}`, $options: "i" } },
        { name: { $regex: queryParam, $options: "i" } },
        { referralCode: { $regex: `^${queryParam}`, $options: "i" } },
      ]
    }

    const users = await User.find(filter)
      .select({ passwordHash: 0 })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()

    const hasMore = users.length > limit
    const trimmedUsers = hasMore ? users.slice(0, -1) : users
    const nextCursor = hasMore ? String(trimmedUsers[trimmedUsers.length - 1]._id) : null

    const userIds = trimmedUsers.map((user) => new mongoose.Types.ObjectId(user._id))

    const [balances, levelHistoryDocs] = await Promise.all([
      userIds.length
        ? Balance.find({ userId: { $in: userIds } })
            .select({ current: 1, totalBalance: 1, totalEarning: 1, lockedCapital: 1, staked: 1, pendingWithdraw: 1 })
            .lean()
        : [],
      userIds.length
        ? LevelHistory.find({ userId: { $in: userIds } })
            .sort({ level: 1 })
            .select({ userId: 1, level: 1, achievedAt: 1 })
            .lean()
        : [],
    ])

    const balanceByUser = new Map(balances.map((balance) => [balance.userId.toString(), balance]))
    const historyByUser = new Map<string, { level: number; achievedAt: string }[]>()

    for (const history of levelHistoryDocs) {
      const key = history.userId.toString()
      const existing = historyByUser.get(key) ?? []
      existing.push({ level: history.level, achievedAt: history.achievedAt.toISOString() })
      historyByUser.set(key, existing)
    }

    const data = trimmedUsers.map((user) => {
      const id = user._id.toString()
      const balance = balanceByUser.get(id) ?? {
        current: 0,
        totalBalance: 0,
        totalEarning: 0,
        lockedCapital: 0,
        staked: 0,
        pendingWithdraw: 0,
      }

      return {
        _id: id,
        name: user.name ?? "",
        email: user.email ?? "",
        referralCode: user.referralCode ?? "",
        role: user.role ?? "user",
        level: Number(user.level ?? 0),
        directActiveCount: Number(user.directActiveCount ?? 0),
        totalActiveDirects: Number(user.totalActiveDirects ?? 0),
        lastLevelUpAt: user.lastLevelUpAt ? new Date(user.lastLevelUpAt).toISOString() : null,
        depositTotal: Number(user.depositTotal ?? 0),
        withdrawTotal: Number(user.withdrawTotal ?? 0),
        roiEarnedTotal: Number(user.roiEarnedTotal ?? 0),
        isActive: Boolean(user.isActive),
        createdAt:
          user.createdAt instanceof Date
            ? user.createdAt.toISOString()
            : new Date(user.createdAt ?? Date.now()).toISOString(),
        balance: {
          current: Number(balance.current ?? 0),
          totalBalance: Number(balance.totalBalance ?? 0),
          totalEarning: Number(balance.totalEarning ?? 0),
          lockedCapital: Number(balance.lockedCapital ?? 0),
          staked: Number(balance.staked ?? 0),
          pendingWithdraw: Number(balance.pendingWithdraw ?? 0),
        },
        levelHistory: historyByUser.get(id) ?? [],
        status: user.status ?? "inactive",
      }
    })

    return NextResponse.json({ data, nextCursor })
  } catch (error) {
    console.error("Admin users error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
