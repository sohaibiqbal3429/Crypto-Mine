import { NextResponse } from "next/server"

import { getPublicWalletAddresses } from "@/lib/services/app-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const wallets = await getPublicWalletAddresses()
    return NextResponse.json({ wallets })
  } catch (error) {
    console.error("Failed to load public wallet addresses", error)
    return NextResponse.json({ error: "Unable to load wallet addresses" }, { status: 500 })
  }
}
