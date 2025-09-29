import dbConnect from "../lib/mongodb.js"
import Settings from "../models/Settings.js"
import CommissionRule from "../models/CommissionRule.js"
import User from "../models/User.js"
import bcrypt from "bcryptjs"

async function seedDatabase() {
  await dbConnect()

  console.log("Seeding database...")

  // Create default settings
  const existingSettings = await Settings.findOne()
  if (!existingSettings) {
    await Settings.create({
      mining: { minPct: 1.5, maxPct: 5.0, roiCap: 3 },
      gating: { minDeposit: 30, minWithdraw: 30, joinNeedsReferral: true, activeMinDeposit: 80 },
      joiningBonus: { threshold: 100, pct: 5 },
      commission: { baseDirectPct: 7, startAtDeposit: 50 },
    })
    console.log("✓ Default settings created")
  }

  // Create commission rules
  const commissionRules = [
    {
      level: 1,
      directPct: 7,
      teamDailyPct: 1,
      teamRewardPct: 0,
      activeMin: 5,
      monthlyTargets: { directSale: 0, bonus: 0 },
    },
    {
      level: 2,
      directPct: 8,
      teamDailyPct: 1,
      teamRewardPct: 0,
      activeMin: 10,
      monthlyTargets: { directSale: 0, bonus: 0 },
    },
    {
      level: 3,
      directPct: 8,
      teamDailyPct: 0,
      teamRewardPct: 2,
      activeMin: 15,
      monthlyTargets: { directSale: 0, bonus: 0 },
    },
    {
      level: 4,
      directPct: 9,
      teamDailyPct: 0,
      teamRewardPct: 2,
      activeMin: 23,
      monthlyTargets: { directSale: 2200, bonus: 200 },
    },
    {
      level: 5,
      directPct: 10,
      teamDailyPct: 0,
      teamRewardPct: 2,
      activeMin: 30,
      monthlyTargets: { directSale: 4500, bonus: 0, salary: 400 },
    },
  ]

  for (const rule of commissionRules) {
    const existing = await CommissionRule.findOne({ level: rule.level })
    if (!existing) {
      await CommissionRule.create(rule)
      console.log(`✓ Commission rule for level ${rule.level} created`)
    }
  }

  // Create admin user
  const adminExists = await User.findOne({ email: "admin@cryptomining.com" })
  if (!adminExists) {
    const passwordHash = await bcrypt.hash("admin123", 12)
    await User.create({
      email: "admin@cryptomining.com",
      passwordHash,
      name: "Admin User",
      role: "admin",
      referralCode: "ADMIN001",
    })
    console.log("✓ Admin user created (admin@cryptomining.com / admin123)")
  }

  console.log("Database seeding completed!")
  process.exit(0)
}

seedDatabase().catch(console.error)
