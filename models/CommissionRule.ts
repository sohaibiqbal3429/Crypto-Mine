import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type CommissionTeamCode = "A" | "B" | "C" | "D"

export interface TeamOverrideRule {
  team: CommissionTeamCode
  /**
   * Depth in the referral tree (Team A = 1, Team B = 2, etc.).
   */
  depth: number
  pct: number
  /**
   * Categorises the override so reporting and audit tooling can distinguish
   * between daily overrides, team commissions and team rewards.
   */
  kind: "daily_override" | "team_commission" | "team_reward"
  /**
   * Determines how the override is posted to the ledger.
   * "commission" credits the spendable balance immediately, while
   * "reward" accrues in the team rewards pool for later claims.
   */
  payout: "commission" | "reward"
  /**
   * Currently overrides only apply to profit events, but keeping the
   * discriminator allows future expansion (e.g. deposit overrides).
   */
  appliesTo: "profit"
}

export interface MonthlyBonusRule {
  /** Monthly Team A sales threshold (USDT) */
  threshold: number
  /** Amount awarded once the threshold is hit */
  amount: number
  /**
   * Bonus designator – used in ledger metadata so both salary and
   * performance bonuses can be tracked independently.
   */
  type: "bonus" | "salary"
  /** Human friendly label (e.g. "Monthly Bonus", "Monthly Salary"). */
  label: string
}

export interface ICommissionRule extends Document {
  level: number
  directPct: number
  teamDailyPct: number
  teamRewardPct: number
  /** Number of personally sponsored active members required */
  activeMin: number
  /**
   * Detailed override matrix pulled from the policy document. Each
   * entry explicitly defines the depth, percentage and payout type so
   * both Team Commission and Team Reward overrides can be processed
   * simultaneously.
   */
  teamOverrides: TeamOverrideRule[]
  /**
   * Monthly Team A sales incentives. Multiple entries allow policies
   * that award both fixed bonuses and recurring salaries once the same
   * target is achieved.
   */
  monthlyBonuses: MonthlyBonusRule[]
  /** Historical field retained for backwards compatibility. */
  monthlyTargets: {
    directSale: number
    bonus: number
    salary?: number
  }
}

const CommissionRuleSchema = new Schema<ICommissionRule>(
  {
    level: { type: Number, required: true, unique: true },
    directPct: { type: Number, required: true },
    teamDailyPct: { type: Number, default: 0 },
    teamRewardPct: { type: Number, default: 0 },
    teamOverrides: {
      type: [
        {
          team: { type: String, enum: ["A", "B", "C", "D"], required: true },
          depth: { type: Number, required: true },
          pct: { type: Number, required: true },
          kind: {
            type: String,
            enum: ["daily_override", "team_commission", "team_reward"],
            default: "team_commission",
          },
          payout: { type: String, enum: ["commission", "reward"], required: true },
          appliesTo: { type: String, enum: ["profit"], default: "profit" },
        },
      ],
      default: [],
    },
    monthlyBonuses: {
      type: [
        {
          threshold: { type: Number, required: true },
          amount: { type: Number, required: true },
          type: { type: String, enum: ["bonus", "salary"], required: true },
          label: { type: String, required: true },
        },
      ],
      default: [],
    },
    monthlyTargets: {
      directSale: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      salary: { type: Number },
    },
    activeMin: { type: Number, required: true },
  },
  {
    timestamps: true,
  },
)

export default createModelProxy<ICommissionRule>("CommissionRule", CommissionRuleSchema)
