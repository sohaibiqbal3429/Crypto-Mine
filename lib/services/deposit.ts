import { mkdir, writeFile } from "fs/promises"
import { extname, join } from "path"
import { createHash, randomUUID } from "crypto"
import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import { getDepositWalletOptionMap } from "@/lib/config/wallet"
import Settings from "@/models/Settings"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import { depositSchema } from "@/lib/validations/wallet"
import { applyDepositRewards, isUserActiveFromDeposits } from "@/lib/services/rewards"
import {
  ACTIVE_DEPOSIT_THRESHOLD,
  DEPOSIT_L1_PERCENT,
  DEPOSIT_L2_PERCENT_ACTIVE,
  DEPOSIT_SELF_PERCENT_ACTIVE,
} from "@/lib/constants/bonuses"

const FAKE_DEPOSIT_AMOUNT = 30
const TEST_TRANSACTION_NUMBER = "FAKE-DEPOSIT-12345"

const HASH_PATTERNS = [
  /^0x[a-fA-F0-9]{64}$/,
  /^[a-fA-F0-9]{64}$/,
  /^[A-Za-z0-9]{50,70}$/,
]

const RECEIPT_UPLOAD_DIRECTORY = join(process.cwd(), "public", "uploads", "deposit-receipts")

async function resolveWalletOption(networkId: string) {
  const optionMap = await getDepositWalletOptionMap()
  const option = optionMap[networkId]
  if (!option) {
    throw new DepositSubmissionError("Selected network is not available at the moment")
  }
  return option
}

function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)
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

// Persist without file-type/size restrictions (as requested)
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
    const firstIssue = parsed.error.issues[0]?.message
    throw new DepositSubmissionError(firstIssue || "Please review the form and try again")
  }

  const normalizedTransactionHash = parsed.data.transactionNumber.trim()
  const isFakeDeposit = normalizedTransactionHash === TEST_TRANSACTION_NUMBER

  const walletOption = await resolveWalletOption(parsed.data.network)

  await dbConnect()

  const user = await User.findById(input.userId)
  if (!user) {
    throw new DepositSubmissionError("User not found", 404)
  }

  if (user.isBlocked) {
    throw new DepositSubmissionError("Blocked accounts cannot submit deposits.", 403)
  }

  const settings = await Settings.findOne()
  const minDeposit = settings?.gating?.minDeposit ?? FAKE_DEPOSIT_AMOUNT

  if (!isFakeDeposit && parsed.data.amount < minDeposit) {
    throw new DepositSubmissionError(`Amount must be at least $${formatAmount(minDeposit)}.`)
  }

  if (!isFakeDeposit && !isLikelyTransactionHash(normalizedTransactionHash)) {
    throw new DepositSubmissionError("Please provide a valid blockchain transaction hash")
  }

  if (!isFakeDeposit && !input.receiptFile) {
    throw new DepositSubmissionError("A payment receipt screenshot from your exchange is required")
  }

  // Guard against duplicate submissions of the same tx hash
  const existingTransaction = await Transaction.findOne({
    "meta.transactionNumber": normalizedTransactionHash,
    type: "deposit",
  })
  if (existingTransaction) {
    throw new DepositSubmissionError("This transaction hash has already been submitted")
  }

  let receiptResult: Awaited<ReturnType<typeof persistReceipt>> | null = null

  // Only persist the receipt after we know it's not a duplicate tx
  if (input.receiptFile) {
    receiptResult = await persistReceipt(input.receiptFile)
  }

  // PENDING path for real deposits: just enqueue review (no payouts here)
  if (!isFakeDeposit) {
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
      activated: false,
    }
  }

  // ---- FAKE DEPOSIT: approve + credit + payouts ATOMICALLY ------------------
  const session = await mongoose.startSession()
  try {
    let result: {
      status: "approved"
      transaction: any
      receiptMeta?: any
      message: string
      activated: boolean
    }

    await session.withTransaction(async () => {
      // 1) Create the approved deposit transaction first (source of truth for sourceTxId)
      const transaction = await Transaction.create(
        [
          {
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
          },
        ],
        { session },
      ).then((docs) => docs[0])

      // 2) Recalculate activation BEFORE applying rewards (post-update status is authoritative)
      const lifetimeBefore = Number(user.depositTotal ?? 0)
      const lifetimeAfter = lifetimeBefore + FAKE_DEPOSIT_AMOUNT
      const wasActive = isUserActiveFromDeposits(lifetimeBefore)
      const nowActive = isUserActiveFromDeposits(lifetimeAfter)

      await User.updateOne(
        { _id: input.userId },
        {
          $inc: { depositTotal: FAKE_DEPOSIT_AMOUNT },
          $set: {
            isActive: nowActive,
            status: nowActive ? "active" : "inactive",
          },
        },
        { session },
      )

      await Balance.updateOne(
        { userId: input.userId },
        {
          $inc: {
            current: FAKE_DEPOSIT_AMOUNT,
            totalBalance: FAKE_DEPOSIT_AMOUNT,
          },
          $setOnInsert: {
            totalEarning: 0,
            staked: 0,
            pendingWithdraw: 0,
            teamRewardsAvailable: 0,
            teamRewardsClaimed: 0,
          },
        },
        { upsert: true, session },
      )

      // 3) Apply deposit rewards (idempotent inside rewards service via sourceTxId)
      const activationId = transaction._id.toString()
      const rewardOutcome = await applyDepositRewards(input.userId, FAKE_DEPOSIT_AMOUNT, {
        depositTransactionId: activationId,
        depositAt: transaction.createdAt,
        // If your rewards service accepts a session, pass it:
        // @ts-ignore – optional for in-memory; safe for real Mongo if implemented
        session,
      })

      const activated = !wasActive && nowActive

      if (activated) {
        await Transaction.updateOne(
          { _id: transaction._id },
          { $set: { "meta.qualifiesForActivation": true } },
          { session },
        )
        transaction.meta = { ...transaction.meta, qualifiesForActivation: true }
      }

      // 4) Enrich transaction with a transparent bonus breakdown
      transaction.meta = {
        ...(transaction.meta ?? {}),
        bonusBreakdown: {
          selfPercent: nowActive ? DEPOSIT_SELF_PERCENT_ACTIVE * 100 : 0,
          l1Percent: DEPOSIT_L1_PERCENT * 100,
          l2Percent: nowActive ? DEPOSIT_L2_PERCENT_ACTIVE * 100 : 0,
          selfAmount: rewardOutcome.selfBonus,
          l1Amount: rewardOutcome.l1Bonus,
          l2Amount: rewardOutcome.l2Bonus,
          l1UserId: rewardOutcome.l1UserId,
          l2UserId: rewardOutcome.l2UserId,
        },
      }
      await transaction.save({ session })

      // 5) Notify the user
      const notificationBodyParts = [
        `Your deposit of $${FAKE_DEPOSIT_AMOUNT.toFixed(2)} has been approved and credited to your account.`,
      ]

      if (activated) {
        notificationBodyParts.push(
          `You are now Active with lifetime deposits of $${lifetimeAfter.toFixed(2)} meeting the $${ACTIVE_DEPOSIT_THRESHOLD.toFixed(
            2,
          )} activation threshold.`,
        )
      } else if (nowActive) {
        notificationBodyParts.push("Your account remains Active.")
      } else {
        const remaining = Math.max(0, ACTIVE_DEPOSIT_THRESHOLD - lifetimeAfter)
        notificationBodyParts.push(
          `Deposit $${remaining.toFixed(2)} more in lifetime totals to become Active and unlock bonuses.`,
        )
      }

      await Notification.create(
        [
          {
            userId: input.userId,
            kind: "deposit-approved",
            title: "Deposit Approved",
            body: notificationBodyParts.join(" "),
          },
        ],
        { session },
      )

      result = {
        status: "approved" as const,
        transaction,
        receiptMeta: receiptResult?.meta,
        message: activated ? "Deposit processed and account activated!" : "Fake deposit processed successfully!",
        activated,
      }
    })

    // @ts-expect-error set in transaction scope
    return result!
  } finally {
    await session.endSession()
  }
}
