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
    const cursorParam = searchParams.get("cursor")?.trim()
    const status = searchParams.get("status") || undefined
    const blockedFilter = searchParams.get("blocked")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const queryParam = searchParams.get("q")?.trim()

    const filter: Record<string, unknown> = {}

    if (cursorParam) {
      if (!mongoose.Types.ObjectId.isValid(cursorParam)) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 })
      }
      filter._id = { $lt: new mongoose.Types.ObjectId(cursorParam) }
    }
    if (status && status !== "all") {
      if (status === "blocked") {
        filter.isBlocked = true
      } else {
        filter.status = status
        filter.isBlocked = { $ne: true }
      }
    }
    if (blockedFilter === "true") {
      filter.isBlocked = true
    } else if (blockedFilter === "false") {
      filter.isBlocked = { $ne: true }
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

    const userIds = trimmedUsers
      .map((user) => {
        const rawId =
          typeof user._id === "string"
            ? user._id
            : typeof (user._id as { toString?: () => string })?.toString === "function"
              ? (user._id as { toString: () => string }).toString()
              : null

        if (!rawId || !mongoose.Types.ObjectId.isValid(rawId)) {
          console.warn("Skipping user with invalid id", user._id)
          return null
        }

        return new mongoose.Types.ObjectId(rawId)
      })
      .filter((id): id is mongoose.Types.ObjectId => id !== null)

    const [balances, levelHistoryDocs] = await Promise.all([
      userIds.length
        ? Balance.find({ userId: { $in: userIds } })
            .select({ current: 1, totalBalance: 1, totalEarning: 1, staked: 1, pendingWithdraw: 1 })
            .lean()
        : [],
      userIds.length
        ? LevelHistory.find({ userId: { $in: userIds } })
            .sort({ level: 1 })
            .select({ userId: 1, level: 1, achievedAt: 1 })
            .lean()
        : [],
    ])

    const balanceByUser = new Map(
      balances
        .map((balance) => {
          const userId = balance.userId ? balance.userId.toString() : null
          return userId ? ([userId, balance] as const) : null
        })
        .filter((entry): entry is readonly [string, (typeof balances)[number]] => entry !== null),
    )
    const historyByUser = new Map<string, { level: number; achievedAt: string }[]>()

    for (const history of levelHistoryDocs) {
      const key = history.userId ? history.userId.toString() : null
      if (!key) continue
      const existing = historyByUser.get(key) ?? []
      existing.push({ level: history.level, achievedAt: history.achievedAt.toISOString() })
      historyByUser.set(key, existing)
    }

    const data = trimmedUsers.map((user) => {
      const id =
        typeof user._id === "string"
          ? user._id
          : typeof (user._id as { toString?: () => string })?.toString === "function"
            ? (user._id as { toString: () => string }).toString()
            : ""
      if (!id) {
        return null
      }
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
        isBlocked: Boolean(user.isBlocked),
        kycStatus:
          user.kycStatus === "pending" || user.kycStatus === "verified" || user.kycStatus === "rejected"
            ? user.kycStatus
            : "unverified",
        createdAt:
          user.createdAt instanceof Date
            ? user.createdAt.toISOString()
            : new Date(user.createdAt ?? Date.now()).toISOString(),
        lastLoginAt:
          user.lastLoginAt instanceof Date
            ? user.lastLoginAt.toISOString()
            : user.lastLoginAt
              ? new Date(user.lastLoginAt).toISOString()
              : null,
        balance: {
          current: Number(balance.current ?? 0),
          totalBalance: Number(balance.totalBalance ?? 0),
          totalEarning: Number(balance.totalEarning ?? 0),
          lockedCapital: 0,
          staked: Number(balance.staked ?? 0),
          pendingWithdraw: Number(balance.pendingWithdraw ?? 0),
        },
        levelHistory: historyByUser.get(id) ?? [],
        status: user.status ?? "inactive",
        profileAvatar:
          typeof user.profileAvatar === "string" && user.profileAvatar ? user.profileAvatar : "avatar-01",
      }
    })

    const sanitizedData = data.filter((entry): entry is (typeof data)[number] => entry !== null)

    return NextResponse.json({ data: sanitizedData, nextCursor })
  } catch (error) {
    console.error("Admin users error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
