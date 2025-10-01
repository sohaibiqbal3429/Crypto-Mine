const mongoose = require("mongoose")
require("dotenv").config({ path: ".env.local" })

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in .env.local")
  console.log("Please add your MongoDB connection string to .env.local")
  process.exit(1)
}

// Import schemas
const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    referralCode: { type: String, required: true, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: false },
    depositTotal: { type: Number, default: 0 },
    withdrawTotal: { type: Number, default: 0 },
    roiEarnedTotal: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    groups: {
      A: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      B: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      C: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      D: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
  },
  { timestamps: true },
)

const BalanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    current: { type: Number, default: 0 },
    totalBalance: { type: Number, default: 0 },
    totalEarning: { type: Number, default: 0 },
    lockedCapital: { type: Number, default: 0 },
    staked: { type: Number, default: 0 },
    pendingWithdraw: { type: Number, default: 0 },
    teamRewardsAvailable: { type: Number, default: 0 },
    teamRewardsClaimed: { type: Number, default: 0 },
    teamRewardsLastClaimedAt: { type: Date },
  },
  { timestamps: true },
)

const SettingsSchema = new mongoose.Schema(
  {
    mining: {
      minPct: { type: Number, default: 1.5 },
      maxPct: { type: Number, default: 5.0 },
      roiCap: { type: Number, default: 3 },
    },
    gating: {
      minDeposit: { type: Number, default: 30 },
      minWithdraw: { type: Number, default: 30 },
      joinNeedsReferral: { type: Boolean, default: true },
      activeMinDeposit: { type: Number, default: 80 },
    },
    joiningBonus: {
      threshold: { type: Number, default: 100 },
      pct: { type: Number, default: 5 },
    },
    commission: {
      baseDirectPct: { type: Number, default: 7 },
      startAtDeposit: { type: Number, default: 50 },
    },
  },
  { timestamps: true },
)

async function setupDatabase() {
  try {
    console.log("🔄 Connecting to MongoDB...")
    await mongoose.connect(MONGODB_URI)
    console.log("✅ Connected to MongoDB successfully")

    const User = mongoose.model("User", UserSchema)
    const Balance = mongoose.model("Balance", BalanceSchema)
    const Settings = mongoose.model("Settings", SettingsSchema)

    // Check if initial user already exists
    const existingUser = await User.findOne({ referralCode: "AAAAAA" })
    if (existingUser) {
      console.log("✅ Initial user with referral code AAAAAA already exists")
    } else {
      // Create initial admin user
      const bcrypt = require("bcryptjs")
      const passwordHash = await bcrypt.hash("admin123", 12)

      const initialUser = await User.create({
        name: "Admin User",
        email: "admin@cryptomining.com",
        passwordHash,
        referralCode: "AAAAAA",
        role: "admin",
        isActive: true,
      })

      console.log("✅ Initial admin user created:", initialUser._id)

      // Create balance for initial user
      await Balance.create({
        userId: initialUser._id,
      })

      console.log("✅ Initial balance created for admin user")
    }

    // Create default settings
    const defaultSettings = {
      mining: {
        minPct: 1.5,
        maxPct: 5.0,
        roiCap: 3,
      },
      gating: {
        minDeposit: 30,
        minWithdraw: 30,
        joinNeedsReferral: true,
        activeMinDeposit: 80,
      },
      joiningBonus: {
        threshold: 100,
        pct: 5,
      },
      commission: {
        baseDirectPct: 7,
        startAtDeposit: 50,
      },
    }

    const existingSettings = await Settings.findOne()
    if (!existingSettings) {
      await Settings.create(defaultSettings)
      console.log("✅ Default settings document created")
    } else {
      console.log("✅ Settings document already exists")
    }

    console.log("\n🎉 Database setup completed successfully!")
    console.log("📝 You can now use the following credentials to test:")
    console.log("   Referral Code: AAAAAA")
    console.log("   Admin Login: admin@cryptomining.com / admin123")
    console.log("\n🚀 Start the development server: npm run dev")
  } catch (error) {
    console.error("❌ Error setting up database:", error.message)
    if (error.message.includes("authentication failed")) {
      console.log("💡 Check your MongoDB username and password in the connection string")
    }
    if (error.message.includes("network")) {
      console.log("💡 Check your internet connection and MongoDB Atlas network access")
    }
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Disconnected from MongoDB")
  }
}

setupDatabase()
