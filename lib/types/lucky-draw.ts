export type LuckyDrawDepositStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface LuckyDrawDepositReceipt {
  url?: string
  originalName?: string
  mimeType?: string
  size?: number
  uploadedAt?: string
  checksum?: string
}

export interface LuckyDrawDeposit {
  id: string
  txHash: string
  receiptReference: string
  submittedAt: string
  status: LuckyDrawDepositStatus
  amountUsd: number
  network?: string
  depositAddress?: string
  exchangePlatform?: string | null
  receipt?: LuckyDrawDepositReceipt | null
  userId?: string
  userName?: string
  userEmail?: string
  roundId?: string
  adminNote?: string | null
  decisionAt?: string | null
  decidedBy?: string | null
}

export interface LuckyDrawRound {
  id: string
  startAtUtc: string
  endAtUtc: string
  prizePoolUsd: number
  announcementAtUtc?: string
  selectedWinner?: {
    name: string
    selectedAt: string
    depositId?: string | null
    userId?: string | null
  } | null
  lastWinner?: {
    name: string
    announcedAt: string
  } | null
}
