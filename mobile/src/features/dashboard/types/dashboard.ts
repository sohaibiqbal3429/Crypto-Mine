export interface DashboardKpis {
  totalEarning: number
  totalBalance: number
  currentBalance: number
  activeMembers: number
  totalWithdraw: number
  pendingWithdraw: number
  teamReward: number
  teamRewardToday?: number
}

export interface DashboardMiningState {
  canMine: boolean
  requiresDeposit?: boolean
  minDeposit: number
  nextEligibleAt: string
  earnedInCycle: number
}

export interface DashboardUserSummary {
  level: number
  referralCode: string
  roiEarnedTotal: number
  depositTotal: number
}

export interface DashboardResponse {
  kpis: DashboardKpis
  mining: DashboardMiningState
  user: DashboardUserSummary
}
