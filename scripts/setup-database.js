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
    directActiveCount: { type: Number, default: 0 },
    totalActiveDirects: { type: Number, default: 0 },
    lastLevelUpAt: { type: Date, default: null },
    qualified: { type: Boolean, default: false },
    qualifiedAt: { type: Date, default: null },
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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dWallet: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    roiEarned: { type: Number, default: 0 },
    commissionEarned: { type: Number, default: 0 },
    lastMiningTime: { type: Date },
    miningStreak: { type: Number, default: 0 },
    roiCapReached: { type: Boolean, default: false },
  },
  { timestamps: true },
)

const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: String,
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
    const passwordHash = await bcrypt.hash("Coin4$", 12)

      const initialUser = await User.create({
        name: "Admin User",
        email: "admin@cryptomining.com",
        passwordHash,
        referralCode: "AAAAAA",
        role: "admin",
        isActive: true,
        qualified: true,
        qualifiedAt: new Date(),
      })

      console.log("✅ Initial admin user created:", initialUser._id)

      // Create balance for initial user
      await Balance.create({
        userId: initialUser._id,
      })

      console.log("✅ Initial balance created for admin user")
    }

    // Create default settings
    const defaultSettings = [
      { key: "miningBaseAmount", value: 10, description: "Base mining amount in USD" },
      { key: "miningMinPercent", value: 0.5, description: "Minimum mining percentage" },
      { key: "miningMaxPercent", value: 2.0, description: "Maximum mining percentage" },
      { key: "roiCap", value: 3.0, description: "ROI cap multiplier (3x)" },
      { key: "minDepositAmount", value: 50, description: "Minimum deposit amount" },
      { key: "minWithdrawAmount", value: 10, description: "Minimum withdrawal amount" },
      {
        key: "commissionRates",
        value: { level1: 10, level2: 5, level3: 3, level4: 2, level5: 1 },
        description: "Commission rates by level",
      },
    ]

    for (const setting of defaultSettings) {
      const existing = await Settings.findOne({ key: setting.key })
      if (!existing) {
        await Settings.create(setting)
        console.log(`✅ Created setting: ${setting.key}`)
      }
    }

    console.log("\n🎉 Database setup completed successfully!")
    console.log("📝 You can now use the following credentials to test:")
    console.log("   Referral Code: AAAAAA")
    console.log("   Admin Login: admin@cryptomining.com / Coin4$")
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
