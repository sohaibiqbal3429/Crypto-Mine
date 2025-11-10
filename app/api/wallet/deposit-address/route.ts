import { NextResponse } from "next/server"

import { getPublicWalletAddresses } from "@/lib/services/app-settings"

export async function GET() {
  const wallets = await getPublicWalletAddresses()

  if (wallets.length === 0) {
    return NextResponse.json({ error: "Deposit address not configured" }, { status: 500 })
  }

  const primary = wallets[0]
  const legacyNetwork = process.env.DEPOSIT_WALLET_NETWORK ?? undefined

  return NextResponse.json({
    address: primary.address,
    network: legacyNetwork ?? primary.network,
    wallets,
  })
}

