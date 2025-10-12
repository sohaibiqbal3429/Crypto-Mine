import { NextResponse } from "next/server"

import { getDepositWalletOptions } from "@/lib/config/wallet"

export async function GET() {
  const options = getDepositWalletOptions().filter((option) =>
    option.network.toLowerCase().includes("bep"),
  )

  if (options.length === 0) {
    return NextResponse.json(
      { error: "No BEP20 deposit wallets are configured." },
      { status: 404 },
    )
  }

  return NextResponse.json({ options })
}

