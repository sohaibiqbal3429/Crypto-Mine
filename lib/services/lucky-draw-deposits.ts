import { mkdir, writeFile } from "fs/promises"
import { extname, join } from "path"
import { createHash, randomUUID } from "crypto"

import mongoose, { type HydratedDocument } from "mongoose"

import dbConnect from "@/lib/mongodb"
import LuckyDrawDeposit from "@/models/LuckyDrawDeposit"
import Balance from "@/models/Balance"
import LedgerEntry from "@/models/LedgerEntry"
import User from "@/models/User"
import type { ILuckyDrawDeposit } from "@/models/LuckyDrawDeposit"
import type { LuckyDrawDeposit as LuckyDrawDepositView } from "@/lib/types/lucky-draw"
import { luckyDrawDepositSchema, luckyDrawAdminDecisionSchema } from "@/lib/validations/lucky-draw"

const LUCKY_DRAW_AMOUNT = 10
const MAX_PENDING_REQUESTS = 3
const RECEIPT_UPLOAD_DIRECTORY = join(process.cwd(), "public", "uploads", "lucky-draw-receipts")

export class LuckyDrawDepositError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export interface LuckyDrawDepositInput {
  userId: string
  transactionHash: string
  receiptUrl?: string
  receiptFile?: File | null
}

export interface LuckyDrawAdminDecisionInput {
  adminId: string
  depositId: string
  note?: string
}

interface PersistedReceipt {
  url: string
  meta: {
    originalName?: string
    mimeType?: string
    size?: number
    uploadedAt: string
    checksum: string
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
    case "application/pdf":
      return ".pdf"
    default:
      return ".png"
  }
}

async function persistReceipt(file: File): Promise<PersistedReceipt> {
  await mkdir(RECEIPT_UPLOAD_DIRECTORY, { recursive: true })

  const extension = resolveReceiptExtension(file)
  const fileName = `${randomUUID()}${extension}`
  const filePath = join(RECEIPT_UPLOAD_DIRECTORY, fileName)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const checksum = createHash("sha256").update(buffer).digest("hex")

  return {
    url: `/uploads/lucky-draw-receipts/${fileName}`,
    meta: {
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      checksum,
    },
  }
}

function toAbsoluteUrl(origin: string | null, path: string | undefined | null): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  if (!origin) return path
  const normalized = path.startsWith("/") ? path : `/${path}`
  const proxied = normalized.startsWith("/api/uploads/") ? normalized : normalized.startsWith("/uploads/") ? `/api/uploads${normalized}` : normalized
  return `${origin}${proxied}`
}

function serializeDeposit(
  deposit: ILuckyDrawDeposit | HydratedDocument<ILuckyDrawDeposit>,
  options: { origin?: string | null; user?: { name?: string | null; email?: string | null } | null } = {},
): LuckyDrawDepositView {
  const receiptUrl = deposit.receipt?.url ?? deposit.transactionReceiptUrl ?? undefined
  const depositId = typeof deposit._id === "string" ? deposit._id : deposit._id?.toString?.() ?? ""
  const decidedBy = typeof deposit.decidedBy === "string" ? deposit.decidedBy : deposit.decidedBy?.toString?.()

  return {
    id: depositId,
    txHash: deposit.transactionHash,
    receiptReference: receiptUrl ?? deposit.transactionHash,
    submittedAt: deposit.createdAt.toISOString(),
    status: deposit.status,
    amountUsd: deposit.amount,
    network: undefined,
    depositAddress: undefined,
    exchangePlatform: null,
    receipt: deposit.receipt
      ? {
          url: toAbsoluteUrl(options.origin ?? null, deposit.receipt.url),
          originalName: deposit.receipt.originalName,
          mimeType: deposit.receipt.mimeType,
          size: deposit.receipt.size,
          uploadedAt: deposit.receipt.uploadedAt,
          checksum: deposit.receipt.checksum,
        }
      : deposit.transactionReceiptUrl
        ? {
            url: toAbsoluteUrl(options.origin ?? null, deposit.transactionReceiptUrl),
          }
        : null,
    userId: deposit.userId?.toString?.(),
    userName: options.user?.name ?? undefined,
    userEmail: options.user?.email ?? undefined,
    roundId: undefined,
    adminNote: deposit.adminNote ?? null,
    decisionAt: deposit.decisionAt ? deposit.decisionAt.toISOString() : null,
    decidedBy: decidedBy ?? null,
  }
}

export async function submitLuckyDrawDeposit(input: LuckyDrawDepositInput): Promise<ILuckyDrawDeposit> {
  const parsed = luckyDrawDepositSchema.safeParse({
    transactionHash: input.transactionHash,
    receiptUrl: input.receiptUrl,
  })

  if (!parsed.success) {
    const message = parsed.error.issues?.[0]?.message ?? "Please review the form and try again."
    throw new LuckyDrawDepositError(message)
  }

  if (!parsed.data.receiptUrl && !input.receiptFile) {
    throw new LuckyDrawDepositError("A receipt image or URL is required")
  }

  await dbConnect()

  const user = await User.findById(input.userId)
  if (!user) {
    throw new LuckyDrawDepositError("User not found", 404)
  }

  const normalizedHash = parsed.data.transactionHash.trim()

  const [pendingCount, existing] = await Promise.all([
    LuckyDrawDeposit.countDocuments({ userId: input.userId, status: "PENDING" }),
    LuckyDrawDeposit.findOne({ transactionHash: normalizedHash }),
  ])

  if (pendingCount >= MAX_PENDING_REQUESTS) {
    throw new LuckyDrawDepositError("You already have 3 pending Lucky Draw deposits. Please wait for review.")
  }

  if (existing) {
    throw new LuckyDrawDepositError("This transaction hash has already been submitted")
  }

  let receiptRecord: PersistedReceipt | null = null

  if (input.receiptFile) {
    try {
      receiptRecord = await persistReceipt(input.receiptFile)
    } catch (error) {
      console.error("Lucky draw receipt persistence failed", error)
      throw new LuckyDrawDepositError("Unable to save receipt. Please try again.")
    }
  }

  const deposit = await LuckyDrawDeposit.create({
    userId: input.userId,
    amount: LUCKY_DRAW_AMOUNT,
    transactionHash: normalizedHash,
    transactionReceiptUrl: receiptRecord ? receiptRecord.url : parsed.data.receiptUrl,
    receipt: receiptRecord
      ? {
          url: receiptRecord.url,
          originalName: receiptRecord.meta.originalName,
          mimeType: receiptRecord.meta.mimeType,
          size: receiptRecord.meta.size,
          uploadedAt: receiptRecord.meta.uploadedAt,
          checksum: receiptRecord.meta.checksum,
        }
      : null,
    status: "PENDING",
  })

  return deposit
}

export async function listLuckyDrawDepositsForUser(
  userId: string,
  limit = 50,
): Promise<HydratedDocument<ILuckyDrawDeposit>[]> {
  await dbConnect()

  return LuckyDrawDeposit.find({ userId })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 200)))
}

export async function listLuckyDrawDepositsForAdmin(options: {
  status?: "PENDING" | "APPROVED" | "REJECTED"
  limit?: number
}): Promise<
  Array<{ deposit: HydratedDocument<ILuckyDrawDeposit>; user: { name?: string | null; email?: string | null } | null }>
> {
  await dbConnect()

  const query: Record<string, unknown> = {}
  if (options.status) {
    query.status = options.status
  }

  const deposits = await LuckyDrawDeposit.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(options.limit ?? 200, 500)))

  const userIds = [...new Set(deposits.map((deposit) => deposit.userId?.toString?.()).filter(Boolean))]

  const users = userIds.length
    ? await User.find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id!)) } })
        .select({ name: 1, email: 1 })
        .lean()
    : []

  const userLookup = new Map(users.map((user) => [user._id?.toString?.() ?? "", { name: user.name, email: user.email }]))

  return deposits.map((deposit) => ({
    deposit,
    user: userLookup.get(deposit.userId?.toString?.() ?? "") ?? null,
  }))
}

export async function approveLuckyDrawDeposit({ adminId, depositId }: LuckyDrawAdminDecisionInput) {
  const decision = luckyDrawAdminDecisionSchema.safeParse({ note: undefined })
  if (!decision.success) {
    throw new LuckyDrawDepositError(decision.error.issues?.[0]?.message ?? "Invalid request")
  }

  await dbConnect()

  const admin = await User.findById(adminId)
  if (!admin || admin.role !== "admin") {
    throw new LuckyDrawDepositError("Unauthorized", 403)
  }

  const deposit = await LuckyDrawDeposit.findById(depositId)
  if (!deposit) {
    throw new LuckyDrawDepositError("Deposit not found", 404)
  }

  if (deposit.status === "APPROVED") {
    throw new LuckyDrawDepositError("Deposit already approved", 409)
  }

  if (deposit.status === "REJECTED") {
    throw new LuckyDrawDepositError("Rejected deposits cannot be approved", 409)
  }

  const runApproval = async (session?: mongoose.ClientSession | null) => {
    const updateResult = await LuckyDrawDeposit.updateOne(
      { _id: deposit._id, status: "PENDING" },
      {
        status: "APPROVED",
        decisionAt: new Date(),
        decidedBy: new mongoose.Types.ObjectId(adminId),
        adminNote: null,
      },
      session ? { session } : undefined,
    )

    if (!updateResult.modifiedCount) {
      throw new LuckyDrawDepositError("Deposit already processed", 409)
    }

    const ledgerPayload = {
      userId: deposit.userId,
      beneficiaryId: deposit.userId,
      sourceUserId: deposit.userId,
      type: "LUCKY_DRAW_DEPOSIT" as const,
      amount: LUCKY_DRAW_AMOUNT,
      rate: null,
      refId: deposit._id,
      meta: {
        transactionHash: deposit.transactionHash,
        receipt: deposit.transactionReceiptUrl ?? deposit.receipt?.url ?? null,
        source: "LuckyDraw",
      },
    }

    if (session) {
      await LedgerEntry.create([ledgerPayload], { session })
    } else {
      await LedgerEntry.create(ledgerPayload)
    }

    await Balance.updateOne(
      { userId: deposit.userId },
      {
        $inc: { luckyDrawCredits: LUCKY_DRAW_AMOUNT },
        $setOnInsert: {
          current: 0,
          totalBalance: 0,
          totalEarning: 0,
          lockedCapital: 0,
          lockedCapitalLots: [],
          staked: 0,
          pendingWithdraw: 0,
          teamRewardsAvailable: 0,
          teamRewardsClaimed: 0,
          teamRewardsLastClaimedAt: null,
        },
      },
      { upsert: true, ...(session ? { session } : {}) },
    )
  }

  let session: mongoose.ClientSession | null = null

  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    try {
      session = await mongoose.startSession()
    } catch (error) {
      console.warn("Lucky draw approval falling back to non-transactional mode", error)
      session = null
    }
  }

  try {
    if (session) {
      await session.withTransaction(async () => {
        await runApproval(session)
      })
    } else {
      await runApproval(null)
    }
  } catch (error: any) {
    if (error instanceof LuckyDrawDepositError) {
      throw error
    }
    if (error?.code === 11000) {
      throw new LuckyDrawDepositError("Deposit already processed", 409)
    }
    console.error("Lucky draw approval failed", error)
    throw new LuckyDrawDepositError("Unable to approve deposit. Please try again.", 500)
  } finally {
    if (session) {
      await session.endSession()
    }
  }

  const updated = await LuckyDrawDeposit.findById(depositId)
  return updated
}

export async function rejectLuckyDrawDeposit({ adminId, depositId, note }: LuckyDrawAdminDecisionInput) {
  const parsed = luckyDrawAdminDecisionSchema.safeParse({ note })
  if (!parsed.success) {
    const message = parsed.error.issues?.[0]?.message ?? "Please review the note and try again."
    throw new LuckyDrawDepositError(message)
  }

  await dbConnect()

  const admin = await User.findById(adminId)
  if (!admin || admin.role !== "admin") {
    throw new LuckyDrawDepositError("Unauthorized", 403)
  }

  const deposit = await LuckyDrawDeposit.findById(depositId)
  if (!deposit) {
    throw new LuckyDrawDepositError("Deposit not found", 404)
  }

  if (deposit.status === "APPROVED") {
    throw new LuckyDrawDepositError("Approved deposits cannot be rejected", 409)
  }

  if (deposit.status === "REJECTED") {
    return deposit
  }

  await LuckyDrawDeposit.updateOne(
    { _id: depositId, status: "PENDING" },
    {
      status: "REJECTED",
      adminNote: parsed.data.note ?? null,
      decisionAt: new Date(),
      decidedBy: new mongoose.Types.ObjectId(adminId),
    },
  )

  const updated = await LuckyDrawDeposit.findById(depositId)
  return updated
}

export function serializeLuckyDrawDeposit(
  deposit: ILuckyDrawDeposit,
  options: { origin?: string | null; user?: { name?: string | null; email?: string | null } | null } = {},
): LuckyDrawDepositView {
  return serializeDeposit(deposit, options)
}
