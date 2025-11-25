import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import WalletAddress from "@/models/WalletAddress"
import { getUserFromRequest } from "@/lib/auth"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const walletAddress = await WalletAddress.findOneAndDelete({
      _id: params.id,
      userId: userPayload.userId,
    })

    if (!walletAddress) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete address error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
