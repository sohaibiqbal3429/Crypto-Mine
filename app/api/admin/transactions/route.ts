import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Transaction from "@/models/Transaction"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(userPayload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const typeParam = searchParams.get("type")
    const statusParam = searchParams.get("status")
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20")))

    // Build query
    const query: any = {}
    if (typeParam && typeParam !== "all") query.type = typeParam
    if (statusParam && statusParam !== "all") query.status = statusParam

    // Get transactions with user data
    const transactions = await Transaction.find(query)
      .populate("userId", "name email referralCode")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    const total = await Transaction.countDocuments(query)

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Admin transactions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
