export interface AdminSessionUser {
  name: string
  email: string
  referralCode: string
  role: string
}

export interface AdminTransactionRecord {
  _id: string
  userId: {
    _id: string
    name: string
    email: string
    referralCode: string
  }
  type: string
  amount: number
  status: string
  meta: Record<string, any>
  createdAt: string
}

export interface AdminUserBalanceSnapshot {
  current: number
  totalBalance: number
  totalEarning: number
  lockedCapital: number
  staked: number
  pendingWithdraw: number
}

export interface AdminUserRecord {
  _id: string
  name: string
  email: string
  referralCode: string
  role: string
  level: number
  directActiveCount: number
  totalActiveDirects: number
  lastLevelUpAt: string | null
  depositTotal: number
  withdrawTotal: number
  roiEarnedTotal: number
  isActive: boolean
  createdAt: string
  balance: AdminUserBalanceSnapshot
  levelHistory: Array<{ level: number; achievedAt: string }>
}

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  pendingDeposits: number
  pendingWithdrawals: number
  totalDeposits: number
  totalWithdrawals: number
}

export interface AdminInitialData {
  adminUser: AdminSessionUser
  transactions: AdminTransactionRecord[]
  users: AdminUserRecord[]
  stats: AdminStats
}
