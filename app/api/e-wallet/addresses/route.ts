import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import WalletAddress from "@/models/WalletAddress"
import { getUserFromRequest } from "@/lib/auth"
import { walletAddressSchema } from "@/lib/validations/wallet"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const addresses = await WalletAddress.find({ userId: userPayload.userId }).sort({ createdAt: -1 })

    return NextResponse.json({ addresses })
  } catch (error) {
    console.error("Get addresses error:", error)
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

    const body = await request.json()
    const validatedData = walletAddressSchema.parse(body)

    // Check if address already exists for this user
    const existingAddress = await WalletAddress.findOne({
      userId: userPayload.userId,
      address: validatedData.address,
    })

    if (existingAddress) {
      return NextResponse.json({ error: "Address already exists" }, { status: 400 })
    }

    const walletAddress = await WalletAddress.create({
      userId: userPayload.userId,
      ...validatedData,
    })

    return NextResponse.json({
      success: true,
      address: walletAddress,
    })
  } catch (error: any) {
    console.error("Add address error:", error)

    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
