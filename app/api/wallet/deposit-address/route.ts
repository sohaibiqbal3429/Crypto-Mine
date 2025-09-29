import { NextResponse } from "next/server"

export async function GET() {
  const depositAddress = process.env.DEPOSIT_WALLET_ADDRESS

  if (!depositAddress) {
    return NextResponse.json(
      { error: "Deposit address not configured" },
      { status: 500 },
    )
  }

  return NextResponse.json({
    address: depositAddress,
    network: process.env.DEPOSIT_WALLET_NETWORK ?? undefined,
  })
}

