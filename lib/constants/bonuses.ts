// bonuses.ts — source of truth for activation + payout percents

// Activation
export const ACTIVE_DEPOSIT_THRESHOLD = 80 as const

// Deposit bonuses (fractions; e.g., 0.05 = 5%)
export const DEPOSIT_SELF_PERCENT_ACTIVE = 0.05 as const         // self bonus when depositor is Active
export const DEPOSIT_L1_PERCENT = 0.15 as const                   // always if L1 exists
export const DEPOSIT_L2_PERCENT_ACTIVE = 0.03 as const            // only if depositor is Active

// Daily team earnings (fractions)
export const TEAM_EARN_L1_PERCENT = 0.02 as const                 // 2% to L1
export const TEAM_EARN_L2_PERCENT = 0.01 as const                 // 1% to L2
export const TEAM_REWARD_UNLOCK_LEVEL = 1 as const                // Level required to receive team rewards

// Optional: consolidated, frozen map (import { PERC } from "...") if you prefer one import
export const PERC = Object.freeze({
  SELF_ACTIVE: DEPOSIT_SELF_PERCENT_ACTIVE,
  L1_DEPOSIT: DEPOSIT_L1_PERCENT,
  L2_DEPOSIT_IF_DEPOSITOR_ACTIVE: DEPOSIT_L2_PERCENT_ACTIVE,
  TEAM_EARN_L1: TEAM_EARN_L1_PERCENT,
  TEAM_EARN_L2: TEAM_EARN_L2_PERCENT,
})

// Optional helpers (pure; do not round here — UI rounds to 2dp)
export const calcPayout = (base: number, percent: number) => base * percent
export const toPercentLabel = (fraction: number, digits = 0) =>
  `${(fraction * 100).toFixed(digits)}%`
