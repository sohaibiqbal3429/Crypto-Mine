import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { submitDeposit, DepositSubmissionError } from "@/lib/services/deposit"

interface ParsedDepositPayload {
  amount: number
  transactionNumber: string
  exchangePlatform?: string
  network: string
}

interface ParsedDepositRequest {
  payload: ParsedDepositPayload
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


export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { payload, receiptFile } = await parseDepositRequest(request)

    const result = await submitDeposit({
      userId: userPayload.userId,
      amount: payload.amount,
      transactionNumber: payload.transactionNumber,
      exchangePlatform: payload.exchangePlatform,
      network: payload.network,
      receiptFile,
    })

    return NextResponse.json({
      success: true,
      transaction: {
        id: result.transaction._id,
        amount: result.transaction.amount,
        status: result.transaction.status,
        createdAt: result.transaction.createdAt,
        ...(result.receiptMeta ? { receiptUrl: result.receiptMeta.url } : {}),
      },
      message: result.message,
      activated: Boolean(result.activated),
    })
  } catch (error: any) {
    if (error instanceof DepositSubmissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      )
    }

    console.error("Deposit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function parseDepositRequest(request: NextRequest): Promise<ParsedDepositRequest> {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()

    const payload: ParsedDepositPayload = {
      amount: coerceNumericValue(formData.get("amount")),
      transactionNumber: coerceStringValue(formData.get("transactionNumber")),
      exchangePlatform: coerceStringValue(formData.get("exchangePlatform")) || undefined,
      network: coerceStringValue(formData.get("network")),
    }

    const receiptEntry = formData.get("receipt")
    const receiptFile = isFileLike(receiptEntry) && receiptEntry.size > 0 ? receiptEntry : null

    return { payload, receiptFile }
  }

  const body = await request.json().catch(() => ({}))

  const payload: ParsedDepositPayload = {
    amount: coerceNumericValue(body?.amount),
    transactionNumber: typeof body?.transactionNumber === "string" ? body.transactionNumber : "",
    exchangePlatform:
      typeof body?.exchangePlatform === "string" && body.exchangePlatform.trim().length > 0
        ? body.exchangePlatform
        : undefined,
    network: coerceStringValue(body?.network),
  }

  return { payload, receiptFile: null }
}

function coerceNumericValue(value: unknown): number {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isNaN(parsed) ? Number.NaN : parsed
  }

  return Number.NaN
}

function coerceStringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}
