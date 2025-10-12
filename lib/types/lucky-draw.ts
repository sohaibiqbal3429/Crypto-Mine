export type DepositStatus = "PENDING" | "ACCEPTED" | "REJECTED"

export interface LuckyDrawDeposit {
  id: string
  txHash: string
  receiptReference: string
  submittedAt: string
  status: DepositStatus
  userId?: string
  userName?: string
  userEmail?: string
  roundId?: string
}

export interface LuckyDrawRound {
  id: string
  startAtUtc: string
  endAtUtc: string
  prizePoolUsd: number
  lastWinner?: {
    name: string
    announcedAt: string
  } | null
}
