// Canonical backend contracts shared by web and mobile clients.

export interface AuthLoginResponse {
  success: boolean
  user: {
    id: string
    name?: string
    email?: string
    role?: string
    referralCode?: string
  }
  token?: string
}

export interface AuthMeResponse {
  success: boolean
  user: {
    id: string
    name?: string
    email?: string
    role?: string
    referralCode?: string
    isBlocked?: boolean
  }
}

export interface WalletBalanceResponse {
  success: boolean
  balance: {
    current: number
    totalBalance: number
    totalEarning: number
    lockedCapital: number
    staked: number
    pendingWithdraw: number
  }
  withdrawableBalance: number
  userStats: {
    depositTotal?: number
    withdrawTotal?: number
    roiEarnedTotal?: number
    level?: number
  }
}

export interface WithdrawRequestPayload {
  amount: number
  walletAddress: string
  source?: "main" | "earnings"
}

export interface WithdrawHistoryResponse {
  success: boolean
  withdrawals: Array<{
    _id: string
    amount: number
    status: string
    createdAt: string
    meta?: Record<string, unknown>
  }>
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface DepositAddressResponse {
  address: string
  network?: string
  wallets: Array<{
    address: string
    network?: string
  }>
}

export interface MiningStatusResponse {
  success: boolean
  canMine: boolean
  requiresDeposit?: boolean
  minDeposit?: number
  baseAmount?: number
  earnedInCycle?: number
  nextEligibleAt?: string
}

export interface MiningStartResponse {
  success: boolean
  canMine: boolean
  baseAmount?: number
  miningSession?: {
    isActive: boolean
    earnedInCycle?: number
    nextEligibleAt?: string
    sessionStartedAt?: string
  }
  userStats?: unknown
}

export interface TasksResponse {
  tasks: Array<{
    _id: string
    title: string
    description?: string
    reward?: number
    completed?: boolean
  }>
}

export interface TaskClaimResponse {
  success: boolean
  reward: number
  claimedAt: string
  balance?: unknown
}

export interface TeamStructureResponse {
  items: Array<{
    _id: string
    name?: string
    level?: number
    qualified?: boolean
    depositTotal?: number
    referredBy?: string
    createdAt?: string
  }>
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface TeamRewardsResponse {
  available: number
  claimedTotal: number
  lastClaimedAt: string | null
  pending: Array<{
    id: string | null
    type: string
    status: string
    amount: number
    percent?: number
    baseAmount?: number
    createdAt?: string | null
    sourceTxId?: string | null
  }>
}

export interface FaqResponse {
  faqs: Array<{
    _id: string
    question: string
    answer: string
  }>
}

export interface SupportTicketsResponse {
  tickets: Array<{
    _id: string
    subject: string
    status: string
    createdAt: string
    messages?: Array<{
      sender: string
      content: string
      createdAt: string
    }>
  }>
}

export interface SupportTicketPayload {
  subject: string
  message: string
}

export interface CoinListResponse {
  coins: Array<{
    _id: string
    name: string
    symbol: string
    price: number
    change24h?: number
  }>
}

export interface AdminSummaryResponse {
  success: boolean
  stats: Record<string, number>
}
