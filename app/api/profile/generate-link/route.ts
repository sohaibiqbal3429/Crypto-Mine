// app/api/referral/generate-link/route.ts
import { NextRequest, NextResponse } from "next/server"

function getBaseUrl(req: NextRequest) {
  // Prefer explicit env, fall back to the request origin (works in dev and prod)
  return (process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "")) || req.nextUrl.origin
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const raw = typeof body?.referralCode === "string" ? body.referralCode : ""
    const referralCode = raw.trim().toUpperCase()

    if (!referralCode) {
      return NextResponse.json(
        { success: false, error: "Referral code is required" },
        { status: 400 }
      )
    }

    const base = getBaseUrl(request)
    const url = new URL("/auth/register", base)
    url.searchParams.set("ref", referralCode)

    return NextResponse.json({
      success: true,
      data: {
        referralCode,
        referralLink: url.toString(),
        message: "Referral link generated successfully",
      },
    })
  } catch (error) {
    console.error("Error generating referral link:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const incoming = (sp.get("code") || sp.get("ref") || "").trim()
    const referralCode = incoming.toUpperCase()

    if (!referralCode) {
      return NextResponse.json(
        { success: false, error: "Referral code parameter is required" },
        { status: 400 }
      )
    }

    const base = getBaseUrl(request)
    const url = new URL("/auth/register", base)
    url.searchParams.set("ref", referralCode)

    return NextResponse.json({
      success: true,
      data: {
        referralCode,
        referralLink: url.toString(),
        message: "Referral link retrieved successfully",
      },
    })
  } catch (error) {
    console.error("Error retrieving referral link:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
