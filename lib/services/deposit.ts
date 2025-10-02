import { mkdir, writeFile } from "fs/promises"
import { extname, join } from "path"
import { createHash, randomUUID } from "crypto"

import dbConnect from "@/lib/mongodb"
import { getDepositWalletOptionMap } from "@/lib/config/wallet"
import Settings from "@/models/Settings"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import { depositSchema } from "@/lib/validations/wallet"
import { calculateUserLevel, processReferralCommission } from "@/lib/utils/commission"

const FAKE_DEPOSIT_AMOUNT = 30
const TEST_TRANSACTION_NUMBER = "FAKE-DEPOSIT-12345"

const HASH_PATTERNS = [
  /^0x[a-fA-F0-9]{64}$/,
  /^[a-fA-F0-9]{64}$/,
  /^[A-Za-z0-9]{50,70}$/,
]

const RECEIPT_UPLOAD_DIRECTORY = join(process.cwd(), "public", "uploads", "deposit-receipts")

function resolveWalletOption(networkId: string) {
  const optionMap = getDepositWalletOptionMap()
  const option = optionMap[networkId]
  if (!option) {
    throw new DepositSubmissionError("Selected network is not available at the moment")
  }
  return option
}

export class DepositSubmissionError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export interface DepositSubmissionInput {
  userId: string
  amount: number
  transactionNumber: string
  exchangePlatform?: string
  network: string
  receiptFile?: File | null
}

function isLikelyTransactionHash(hash: string): boolean {
  if (!hash) return false
  return HASH_PATTERNS.some((pattern) => pattern.test(hash.trim()))
}

// ? Updated function without file-type/size restrictions
async function persistReceipt(file: File) {
  try {
    await mkdir(RECEIPT_UPLOAD_DIRECTORY, { recursive: true })

    const extension = resolveReceiptExtension(file)
    const fileName = `${randomUUID()}${extension}`
    const filePath = join(RECEIPT_UPLOAD_DIRECTORY, fileName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const checksum = createHash("sha256").update(buffer).digest("hex")

    return {
      filePath,
      meta: {
        url: `/uploads/deposit-receipts/${fileName}`,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        checksum,
      },
    }
  } catch (error) {
    console.error("Deposit receipt persistence failed", error)
    throw new DepositSubmissionError("Unable to save receipt. Please try again.")
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

export async function submitDeposit(input: DepositSubmissionInput) {
  const parsed = depositSchema.safeParse({
    amount: input.amount,
    transactionNumber: input.transactionNumber,
    exchangePlatform: input.exchangePlatform,
    network: input.network,
  })

  if (!parsed.success) {
    throw new DepositSubmissionError("Please review the form and try again")
  }

  const walletOption = resolveWalletOption(parsed.data.network)

  await dbConnect()

  const user = await User.findById(input.userId)
  if (!user) {
    throw new DepositSubmissionError("User not found", 404)
  }

  const settings = await Settings.findOne()
  const minDeposit = settings?.gating?.minDeposit ?? FAKE_DEPOSIT_AMOUNT

  const normalizedTransactionHash = parsed.data.transactionNumber.trim()
  const isFakeDeposit = normalizedTransactionHash === TEST_TRANSACTION_NUMBER

  if (!isFakeDeposit && parsed.data.amount < minDeposit) {
    throw new DepositSubmissionError(`Minimum deposit is $${minDeposit} USDT`)
  }

  if (!isFakeDeposit && !isLikelyTransactionHash(normalizedTransactionHash)) {
    throw new DepositSubmissionError("Please provide a valid blockchain transaction hash")
  }

  if (!isFakeDeposit && !input.receiptFile) {
    throw new DepositSubmissionError("A payment receipt screenshot from your exchange is required")
  }

  const existingTransaction = await Transaction.findOne({
    "meta.transactionNumber": normalizedTransactionHash,
    type: "deposit",
  })

  if (existingTransaction) {
    throw new DepositSubmissionError("This transaction hash has already been submitted")
  }

  let receiptResult: Awaited<ReturnType<typeof persistReceipt>> | null = null

  if (input.receiptFile) {
    receiptResult = await persistReceipt(input.receiptFile)
  }


  if (isFakeDeposit) {
    const transaction = await Transaction.create({
      userId: input.userId,
      type: "deposit",
      amount: FAKE_DEPOSIT_AMOUNT,
      status: "approved",
      meta: {
        transactionNumber: normalizedTransactionHash,
        transactionHash: normalizedTransactionHash,
        depositWalletAddress: walletOption.address,
        depositNetwork: walletOption.network,
        depositNetworkId: walletOption.id,
        isFakeDeposit: true,
        exchangePlatform: parsed.data.exchangePlatform ?? null,
        ...(receiptResult ? { receipt: receiptResult.meta } : {}),
      },
    })

    await Promise.all([
      User.updateOne(
        { _id: input.userId },
        { $inc: { depositTotal: FAKE_DEPOSIT_AMOUNT } },
      ),
      Balance.updateOne(
        { userId: input.userId },
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

    await processReferralCommission(input.userId, FAKE_DEPOSIT_AMOUNT)
    await calculateUserLevel(input.userId)

    await Notification.create({
      userId: input.userId,
      kind: "deposit-approved",
      title: "Deposit Approved",
      body: `Your deposit of $${FAKE_DEPOSIT_AMOUNT.toFixed(2)} has been approved and credited to your account.`,
    })

    return {
      status: "approved" as const,
      transaction,
      receiptMeta: receiptResult?.meta,
      message: "Fake deposit processed successfully!",
    }
  }

  const transaction = await Transaction.create({
    userId: input.userId,
    type: "deposit",
    amount: parsed.data.amount,
    status: "pending",
    meta: {
      transactionNumber: normalizedTransactionHash,
      transactionHash: normalizedTransactionHash,
      depositWalletAddress: walletOption.address,
      depositNetwork: walletOption.network,
      depositNetworkId: walletOption.id,
      exchangePlatform: parsed.data.exchangePlatform ?? null,
      ...(receiptResult ? { receipt: receiptResult.meta } : {}),
    },
  })

  return {
    status: "pending" as const,
    transaction,
    receiptMeta: receiptResult?.meta,
    message: `Deposit submitted for review (${walletOption.network})`,
  }
}
