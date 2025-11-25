import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import {
  LuckyDrawDepositError,
  submitLuckyDrawDeposit,
  serializeLuckyDrawDeposit,
} from "@/lib/services/lucky-draw-deposits"

interface ParsedLuckyDrawRequest {
  transactionHash: string
  receiptUrl?: string
  receiptFile: File | null
}

function isFileLike(value: unknown): value is File {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.size === "number" &&
    typeof candidate.name === "string" &&
    candidate.name.length > 0
  )
}

async function parseRequest(request: NextRequest): Promise<ParsedLuckyDrawRequest> {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const transactionHash = String(formData.get("transactionHash") ?? "").trim()
    const receiptUrl = String(formData.get("receiptUrl") ?? "").trim()
    const receiptEntry = formData.get("receipt")
    const receiptFile = isFileLike(receiptEntry) && receiptEntry.size > 0 ? receiptEntry : null

    return {
      transactionHash,
      receiptUrl: receiptUrl.length > 0 ? receiptUrl : undefined,
      receiptFile,
    }
  }

  const body = await request.json().catch(() => ({}))
  const transactionHash = typeof body?.transactionHash === "string" ? body.transactionHash.trim() : ""
  const receiptUrl = typeof body?.receiptUrl === "string" ? body.receiptUrl.trim() : undefined

  return {
    transactionHash,
    receiptUrl: receiptUrl && receiptUrl.length > 0 ? receiptUrl : undefined,
    receiptFile: null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getUserFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { transactionHash, receiptUrl, receiptFile } = await parseRequest(request)

    const deposit = await submitLuckyDrawDeposit({
      userId: session.userId,
      transactionHash,
      receiptUrl,
      receiptFile,
    })

    const origin = new URL(request.url).origin
    const payload = serializeLuckyDrawDeposit(deposit, { origin })

    return NextResponse.json({ deposit: payload, status: deposit.status }, { status: 201 })
  } catch (error: any) {
    if (error instanceof LuckyDrawDepositError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    console.error("Lucky draw deposit submission error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
