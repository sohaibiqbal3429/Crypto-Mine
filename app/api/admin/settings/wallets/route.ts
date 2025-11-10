import { revalidatePath } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import {
  getWalletSettingsForAdmin,
  updateWalletAddressSettings,
  WalletSettingsRateLimitError,
  WalletSettingsValidationError,
} from "@/lib/services/app-settings"

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

async function requireAdminUser(request: NextRequest) {
  const session = getUserFromRequest(request)
  if (!session) {
    return null
  }

  await dbConnect()
  const user = await User.findById(session.userId).select({ role: 1, name: 1, email: 1 })

  if (!user || user.role !== "admin") {
    return null
  }

  return user
}

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdminUser(request)
    if (!adminUser) {
      return unauthorizedResponse()
    }

    const wallets = await getWalletSettingsForAdmin()
    return NextResponse.json({ wallets })
  } catch (error) {
    console.error("Failed to load wallet settings", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminUser = await requireAdminUser(request)
    if (!adminUser) {
      return unauthorizedResponse()
    }

    let payload: any
    try {
      payload = await request.json()
    } catch (error) {
      console.error("Invalid JSON payload for wallet settings", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if (!payload || payload.confirm !== true) {
      return NextResponse.json({ error: "Confirmation is required to update wallet addresses" }, { status: 400 })
    }

    const wallet1 = typeof payload.wallet1 === "string" ? payload.wallet1 : ""
    const wallet2 = typeof payload.wallet2 === "string" ? payload.wallet2 : ""
    const wallet3 = typeof payload.wallet3 === "string" ? payload.wallet3 : ""
    const reason = typeof payload.reason === "string" ? payload.reason : null

    const nextWallets = await updateWalletAddressSettings({
      wallet1,
      wallet2,
      wallet3,
      adminId: adminUser._id.toString(),
      ipAddress: request.ip ?? request.headers.get("x-forwarded-for") ?? null,
      reason,
    })

    revalidatePath("/deposit")
    revalidatePath("/wallet/deposit")

    return NextResponse.json({ wallets: nextWallets })
  } catch (error) {
    if (error instanceof WalletSettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }

    if (error instanceof WalletSettingsRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 })
    }

    console.error("Failed to update wallet settings", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
