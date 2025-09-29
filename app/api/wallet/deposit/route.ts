import { type NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import { extname, join } from "path"
import { randomUUID } from "crypto"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import Settings from "@/models/Settings"
import { getUserFromRequest } from "@/lib/auth"
import { depositSchema } from "@/lib/validations/wallet"
import { processReferralCommission } from "@/lib/utils/commission"

const FAKE_DEPOSIT_AMOUNT = 30
const TEST_TRANSACTION_NUMBER = "FAKE-DEPOSIT-12345"

const RECEIPT_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
])
const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const RECEIPT_UPLOAD_DIRECTORY = join(process.cwd(), "public", "uploads", "deposit-receipts")

class ReceiptValidationError extends Error {}

interface ParsedDepositPayload {
  amount: number
  transactionNumber: string
}

interface ParsedDepositRequest {
  payload: ParsedDepositPayload
  receiptFile: File | null
}

export async function POST(request: NextRequest) {
  try {
    const configuredDepositAddress = process.env.DEPOSIT_WALLET_ADDRESS
    if (!configuredDepositAddress) {
      return NextResponse.json(
        { error: "Deposit address not configured" },
        { status: 500 },
      )
    }

    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const { payload, receiptFile } = await parseDepositRequest(request)
    const validatedData = depositSchema.parse(payload)

    const settings = await Settings.findOne()
    const minDeposit = settings?.gating?.minDeposit ?? FAKE_DEPOSIT_AMOUNT

    if (validatedData.amount < minDeposit) {
      return NextResponse.json(
        { error: `Minimum deposit is $${minDeposit} USDT` },
        { status: 400 },
      )
    }

    const receiptMeta = receiptFile ? await persistReceipt(receiptFile) : null

    const isFakeDeposit = validatedData.transactionNumber === TEST_TRANSACTION_NUMBER

    if (isFakeDeposit) {
      const transaction = await Transaction.create({
        userId: userPayload.userId,
        type: "deposit",
        amount: FAKE_DEPOSIT_AMOUNT,
        status: "approved",
        meta: {
          transactionNumber: validatedData.transactionNumber,
          depositWalletAddress: configuredDepositAddress,
          isFakeDeposit: true,
          ...(receiptMeta ? { receipt: receiptMeta } : {}),
        },
      })

      await Promise.all([
        User.updateOne(
          { _id: userPayload.userId },
          { $inc: { depositTotal: FAKE_DEPOSIT_AMOUNT } },
        ),
        Balance.updateOne(
          { userId: userPayload.userId },
          {
            $inc: {
              current: FAKE_DEPOSIT_AMOUNT,
              totalBalance: FAKE_DEPOSIT_AMOUNT,
              lockedCapital: FAKE_DEPOSIT_AMOUNT,
            },
          },
          { upsert: true },
        ),
      ])

      await processReferralCommission(userPayload.userId, FAKE_DEPOSIT_AMOUNT)

      await Notification.create({
        userId: userPayload.userId,
        kind: "deposit-approved",
        title: "Deposit Approved",
        body: `Your deposit of $${FAKE_DEPOSIT_AMOUNT.toFixed(2)} has been approved and credited to your account.`,
      })

      return NextResponse.json({
        success: true,
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          status: transaction.status,
          createdAt: transaction.createdAt,
          ...(receiptMeta ? { receiptUrl: receiptMeta.url } : {}),
        },
        message: "Fake deposit processed successfully!",
      })
    }

    const transaction = await Transaction.create({
      userId: userPayload.userId,
      type: "deposit",
      amount: validatedData.amount,
      status: "pending",
      meta: {
        transactionNumber: validatedData.transactionNumber,
        depositWalletAddress: configuredDepositAddress,
        ...(receiptMeta ? { receipt: receiptMeta } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction._id,
        amount: transaction.amount,
        status: transaction.status,
        createdAt: transaction.createdAt,
        ...(receiptMeta ? { receiptUrl: receiptMeta.url } : {}),
      },
    })
  } catch (error: any) {
    console.error("Deposit error:", error)

    if (error instanceof ReceiptValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

async function parseDepositRequest(request: NextRequest): Promise<ParsedDepositRequest> {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()

    const payload: ParsedDepositPayload = {
      amount: coerceNumericValue(formData.get("amount")),
      transactionNumber: coerceStringValue(formData.get("transactionNumber")),
    }

    const receiptEntry = formData.get("receipt")
    const receiptFile = receiptEntry instanceof File && receiptEntry.size > 0 ? receiptEntry : null

    return { payload, receiptFile }
  }

  const body = await request.json().catch(() => ({}))

  const payload: ParsedDepositPayload = {
    amount: coerceNumericValue(body?.amount),
    transactionNumber: typeof body?.transactionNumber === "string" ? body.transactionNumber : "",
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

async function persistReceipt(file: File) {
  if (!RECEIPT_ALLOWED_MIME_TYPES.has(file.type)) {
    throw new ReceiptValidationError("Receipt must be an image (PNG, JPG, JPEG, WEBP, or GIF)")
  }

  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    throw new ReceiptValidationError("Receipt image must be smaller than 5MB")
  }

  await mkdir(RECEIPT_UPLOAD_DIRECTORY, { recursive: true })

  const extension = resolveReceiptExtension(file)
  const fileName = `${randomUUID()}${extension}`
  const filePath = join(RECEIPT_UPLOAD_DIRECTORY, fileName)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  return {
    url: `/uploads/deposit-receipts/${fileName}`,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

function resolveReceiptExtension(file: File) {
  const derivedExtension = extname(file.name).toLowerCase()
  if (derivedExtension) {
    return derivedExtension
  }

  switch (file.type) {
    case "image/png":
      return ".png"
    case "image/jpeg":
    case "image/jpg":
      return ".jpg"
    case "image/webp":
      return ".webp"
    case "image/gif":
      return ".gif"
    default:
      return ".png"
  }
}
