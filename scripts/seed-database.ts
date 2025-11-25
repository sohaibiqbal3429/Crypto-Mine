import bcrypt from "bcryptjs"
import dotenv from "dotenv"
import path from "path"

// ✅ Always load env from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import dbConnect from "../lib/mongodb"
import CommissionRule from "../models/CommissionRule"
import Settings from "../models/Settings"
import User from "../models/User"

type SettingsSeedDoc = {
  dailyProfitPercent?: number | string
  mining: {
    minPct: number
    maxPct: number
    roiCap: number
  }
  gating: {
    minDeposit: number
    minWithdraw: number
    joinNeedsReferral: boolean
    activeMinDeposit: number
  }
  joiningBonus: {
    threshold: number
    pct: number
  }
  commission: {
    baseDirectPct: number
    startAtDeposit: number
    highTierPct: number
    highTierStartAt: number
  }
}

type CommissionRuleSeedDoc = {
  level: number
  directPct: number
  teamDailyPct: number
  teamRewardPct: number
  activeMin: number
  teamOverrides: {
    team: "A" | "B" | "C" | "D"
    depth: number
    pct: number
    kind: "daily_override" | "team_commission" | "team_reward"
    payout: "commission" | "reward"
    appliesTo: "profit"
  }[]
  monthlyBonuses: {
    threshold: number
    amount: number
    type: "bonus" | "salary"
    label: string
  }[]
  monthlyTargets: {
    directSale: number
    bonus: number
    salary?: number
  }
}

type UserSeedDoc = {
  email: string
  passwordHash: string
  name: string
  role: "user" | "admin"
  referralCode: string
  status?: "active" | "inactive" | "suspended"
  isActive?: boolean
  isBlocked?: boolean
  profileAvatar?: string
  kycStatus?: "unverified" | "pending" | "verified" | "rejected"
  phoneVerified?: boolean
  emailVerified?: boolean
  lastLoginAt?: Date
}

type InMemoryModel<T extends Record<string, unknown>> = {
  data: T[]
  findOne(filter?: Partial<T>): Promise<T | null>
  create(doc: T): Promise<T>
}

function createMemoryModel<T extends Record<string, unknown>>(): InMemoryModel<T> {
  const data: T[] = []

  function matchesFilter(doc: T, filter: Partial<T>): boolean {
    return Object.entries(filter).every(([key, value]) => {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        const docValue = doc[key as keyof T]
        if (docValue === null || typeof docValue !== "object") return false
        return matchesFilter(docValue as unknown as T, value as Partial<T>)
      }
      return doc[key as keyof T] === value
    })
  }

  return {
    data,
    async findOne(filter?: Partial<T>) {
      if (!filter || Object.keys(filter).length === 0) {
        return data[0] ?? null
      }
      return data.find((doc) => matchesFilter(doc, filter)) ?? null
    },
    async create(doc: T) {
      const created = JSON.parse(JSON.stringify(doc)) as T
      data.push(created)
      return created
    },
  }
}

const inMemoryStores = {
  settings: createMemoryModel<SettingsSeedDoc>(),
  commissionRules: createMemoryModel<CommissionRuleSeedDoc>(),
  users: createMemoryModel<UserSeedDoc>(),
}

interface MemoryState {
  settings: SettingsSeedDoc[]
  commissionRules: CommissionRuleSeedDoc[]
  users: UserSeedDoc[]
}

export interface SeedResult {
  createdSettings: boolean
  createdCommissionLevels: number[]
  createdAdmin: boolean
  memoryState?: MemoryState
}

export async function seedDatabase(): Promise<SeedResult> {
  const useInMemory = process.env.SEED_IN_MEMORY === "true"
  const memory = useInMemory ? inMemoryStores : null

  if (useInMemory) {
    console.log("Running seed in in-memory mode (SEED_IN_MEMORY=true)")
  } else {
    console.log("🔌 Connecting to MongoDB...")
    await dbConnect()
    console.log("✅ MongoDB connected!")
  }

  console.log("⚡ Seeding database...")

  const createdCommissionLevels: number[] = []
  let createdSettings = false
  let createdAdmin = false

  // ---------- SETTINGS ----------
  const settingsModel = (memory?.settings ?? Settings) as {
    findOne: (filter?: Record<string, unknown>) => Promise<SettingsSeedDoc | null>
    create: (doc: SettingsSeedDoc) => Promise<SettingsSeedDoc>
    data?: SettingsSeedDoc[]
  }

  const existingSettings = await settingsModel.findOne()
  if (!existingSettings) {
    await settingsModel.create({
      dailyProfitPercent: 1.5,
      mining: { minPct: 1.5, maxPct: 1.5, roiCap: 3 },
      gating: { minDeposit: 30, minWithdraw: 30, joinNeedsReferral: true, activeMinDeposit: 80 },
      joiningBonus: { threshold: 0, pct: 0 },
      commission: { baseDirectPct: 0, startAtDeposit: 50, highTierPct: 5, highTierStartAt: 100 },
    })
    createdSettings = true
    console.log("✓ Default settings created")
  }

  // ---------- COMMISSION RULES ----------
  const commissionRules: CommissionRuleSeedDoc[] = [
    {
      level: 1,
      directPct: 7,
      teamDailyPct: 1,
      teamRewardPct: 0,
      activeMin: 5,
      teamOverrides: [
        {
          team: "A",
          depth: 1,
          pct: 1,
          kind: "daily_override",
          payout: "commission",
          appliesTo: "profit",
        },
      ],
      monthlyBonuses: [],
      monthlyTargets: { directSale: 0, bonus: 0 },
    },
    {
      level: 2,
      directPct: 8,
      teamDailyPct: 1,
      teamRewardPct: 0,
      activeMin: 10,
      teamOverrides: [
        {
          team: "A",
          depth: 1,
          pct: 1,
          kind: "daily_override",
          payout: "commission",
          appliesTo: "profit",
        },
        {
          team: "B",
          depth: 2,
          pct: 1,
          kind: "daily_override",
          payout: "commission",
          appliesTo: "profit",
        },
        {
          team: "C",
          depth: 3,
          pct: 1,
          kind: "daily_override",
          payout: "commission",
          appliesTo: "profit",
        },
      ],
      monthlyBonuses: [],
      monthlyTargets: { directSale: 0, bonus: 0 },
    },
    {
      level: 3,
      directPct: 8,
      teamDailyPct: 0,
      teamRewardPct: 2,
      activeMin: 15,
      teamOverrides: [
        {
          team: "A",
          depth: 1,
          pct: 8,
          kind: "team_commission",
          payout: "commission",
          appliesTo: "profit",
        },
        {
          team: "B",
          depth: 2,
          pct: 8,
          kind: "team_commission",
          payout: "commission",
          appliesTo: "profit",
        },
        {
          team: "C",
          depth: 3,
          pct: 8,
          kind: "team_commission",
          payout: "commission",
          appliesTo: "profit",
        },
        {
          team: "D",
          depth: 4,
          pct: 8,
          kind: "team_commission",
          payout: "commission",
          appliesTo: "profit",
        },
        {
          team: "A",
          depth: 1,
          pct: 2,
          kind: "team_reward",
          payout: "reward",
          appliesTo: "profit",
        },
        {
          team: "B",
          depth: 2,
          pct: 2,
          kind: "team_reward",
          payout: "reward",
          appliesTo: "profit",
        },
        {
          team: "C",
          depth: 3,
          pct: 2,
          kind: "team_reward",
          payout: "reward",
          appliesTo: "profit",
        },
        {
          team: "D",
          depth: 4,
          pct: 2,
          kind: "team_reward",
          payout: "reward",
          appliesTo: "profit",
        },
      ],
      monthlyBonuses: [],
      monthlyTargets: { directSale: 0, bonus: 0 },
    },
    {
      level: 4,
      directPct: 9,
      teamDailyPct: 0,
      teamRewardPct: 0,
      activeMin: 23,
      teamOverrides: [
        {
          team: "A",
          depth: 1,
          pct: 2,
          kind: "team_commission",
          payout: "commission",
          appliesTo: "profit",
        },
        {
          team: "B",
          depth: 2,
          pct: 2,
          kind: "team_commission",
          payout: "commission",
          appliesTo: "profit",
        },
        {
          team: "C",
          depth: 3,
          pct: 2,
          kind: "team_commission",
          payout: "commission",
          appliesTo: "profit",
        },
        {
          team: "D",
          depth: 4,
          pct: 2,
          kind: "team_commission",
          payout: "commission",
          appliesTo: "profit",
        },
      ],
      monthlyBonuses: [
        { threshold: 2200, amount: 200, type: "bonus", label: "Monthly Bonus" },
      ],
      monthlyTargets: { directSale: 2200, bonus: 200 },
    },
    {
      level: 5,
      directPct: 10,
      teamDailyPct: 0,
      teamRewardPct: 2,
      activeMin: 30,
      teamOverrides: [
        {
          team: "A",
          depth: 1,
          pct: 2,
          kind: "team_reward",
          payout: "reward",
          appliesTo: "profit",
        },
        {
          team: "B",
          depth: 2,
          pct: 2,
          kind: "team_reward",
          payout: "reward",
          appliesTo: "profit",
        },
        {
          team: "C",
          depth: 3,
          pct: 2,
          kind: "team_reward",
          payout: "reward",
          appliesTo: "profit",
        },
        {
          team: "D",
          depth: 4,
          pct: 2,
          kind: "team_reward",
          payout: "reward",
          appliesTo: "profit",
        },
      ],
      monthlyBonuses: [
        { threshold: 4500, amount: 400, type: "salary", label: "Monthly Salary" },
      ],
      monthlyTargets: { directSale: 4500, bonus: 0, salary: 400 },
    },
  ]

  const commissionRuleModel = (memory?.commissionRules ?? CommissionRule) as {
    findOne: (filter: Record<string, unknown>) => Promise<CommissionRuleSeedDoc | null>
    create: (doc: CommissionRuleSeedDoc) => Promise<CommissionRuleSeedDoc>
    data?: CommissionRuleSeedDoc[]
  }

  for (const rule of commissionRules) {
    const existing = await commissionRuleModel.findOne({ level: rule.level })
    if (!existing) {
      await commissionRuleModel.create(rule)
      createdCommissionLevels.push(rule.level)
      console.log(`✓ Commission rule for level ${rule.level} created`)
    }
  }

  // ---------- ADMIN USER ----------
  const userModel = (memory?.users ?? User) as {
    findOne: (filter: Record<string, unknown>) => Promise<UserSeedDoc | null>
    create: (doc: UserSeedDoc) => Promise<UserSeedDoc>
    data?: UserSeedDoc[]
  }

  const adminExists = await userModel.findOne({ email: "admin@cryptomining.com" })
  if (!adminExists) {
    const passwordHash = await bcrypt.hash("Coin4$", 12)
    await userModel.create({
      email: "admin@cryptomining.com",
      passwordHash,
      name: "Admin User",
      role: "admin",
      referralCode: "ADMIN001",
      status: "active",
      isActive: true,
      isBlocked: false,
      profileAvatar: "avatar-01",
      kycStatus: "verified",
      phoneVerified: true,
      emailVerified: true,
      lastLoginAt: new Date(),
    })
    createdAdmin = true
    console.log("✓ Admin user created (admin@cryptomining.com / Coin4$)")
  }

  console.log("🎉 Database seeding completed!")

  const result: SeedResult = {
    createdSettings,
    createdCommissionLevels,
    createdAdmin,
  }

  if (memory) {
    result.memoryState = {
      settings: memory.settings.data,
      commissionRules: memory.commissionRules.data,
      users: memory.users.data,
    }
  }

  return result
}

// Run directly
if (process.argv[1]?.includes("seed-database")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Seed error:", error)
      process.exit(1)
    })
}
