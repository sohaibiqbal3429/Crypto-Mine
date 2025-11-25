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
  status?: string
  level: number
  directActiveCount: number
  totalActiveDirects: number
  lastLevelUpAt: string | null
  depositTotal: number
  withdrawTotal: number
  roiEarnedTotal: number
  isActive: boolean
  isBlocked: boolean
  kycStatus: "unverified" | "pending" | "verified" | "rejected"
  createdAt: string
  lastLoginAt: string | null
  balance: AdminUserBalanceSnapshot
  levelHistory: Array<{ level: number; achievedAt: string }>
  profileAvatar: string
}

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  pendingDeposits: number
  pendingWithdrawals: number
  totalDeposits: number
  totalWithdrawals: number
  pendingLuckyDrawDeposits: number
}

export interface AdminWalletSetting {
  id: string
  key: string
  label: string
  network: string
  address: string
  source: "db" | "env" | "unset"
  updatedAt: string | null
  updatedBy: { id: string; name: string | null; email: string | null } | null
}

export interface AdminPlatformSettings {
  dailyProfitPercent: number
  bounds: {
    min: number
    max: number
  }
  wallets: AdminWalletSetting[]
}

export interface AdminInitialData {
  adminUser: AdminSessionUser
  transactions: AdminTransactionRecord[]
  users: AdminUserRecord[]
  stats: AdminStats
  settings: AdminPlatformSettings
}
