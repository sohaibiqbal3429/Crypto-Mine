import mongoose from "mongoose"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import { emitAuditLog } from "@/lib/observability/audit"

interface RouteParams {
  params: {
    id: string
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const actingUser = getUserFromRequest(request)
    if (!actingUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!params?.id || !mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
    }

    await dbConnect()

    const adminUser = await User.findById(actingUser.userId)
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = (await request.json().catch(() => ({}))) as {
      blocked?: unknown
      reason?: unknown
    }
    const shouldBlock = Boolean(payload.blocked)
    const reason = typeof payload.reason === "string" ? payload.reason.trim().slice(0, 500) : ""

    const targetUser = await User.findById(params.id)
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    targetUser.isBlocked = shouldBlock
    targetUser.blockedAt = shouldBlock ? new Date() : null

    await targetUser.save()

    const targetId = (targetUser._id as mongoose.Types.ObjectId).toString()

    emitAuditLog({
      event: shouldBlock ? "admin.user.blocked" : "admin.user.unblocked",
      actorId: actingUser.userId,
      metadata: {
        userId: targetId,
        reason: reason || undefined,
      },
    })

    return NextResponse.json({
      user: {
        _id: targetId,
        isBlocked: targetUser.isBlocked,
        blockedAt: targetUser.blockedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error("Admin block user error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
