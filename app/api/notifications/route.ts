import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import Notification from "@/models/Notification"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    // Get notifications
    const notifications = await Notification.find({ userId: userPayload.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Notification.countDocuments({ userId: userPayload.userId })
    const unreadCount = await Notification.countDocuments({ userId: userPayload.userId, read: false })

    return NextResponse.json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Notifications error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const { notificationId, markAllRead } = await request.json()

    if (markAllRead) {
      // Mark all notifications as read
      await Notification.updateMany({ userId: userPayload.userId, read: false }, { read: true })
    } else if (notificationId) {
      // Mark specific notification as read
      await Notification.updateOne({ _id: notificationId, userId: userPayload.userId }, { read: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update notifications error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
