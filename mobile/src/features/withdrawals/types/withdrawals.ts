export interface WithdrawalEntry {
  _id: string
  amount: number
  status: string
  createdAt: string
  meta?: Record<string, unknown>
}

export interface WithdrawalStats {
  [status: string]: {
    count: number
    totalAmount: number
  }
}

export interface WithdrawalHistoryResponse {
  success: boolean
  withdrawals: WithdrawalEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats: WithdrawalStats
}
