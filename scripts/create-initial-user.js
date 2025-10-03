const mongoose = require("mongoose")

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/crypto-mining"

// User schema (simplified for seeding)
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

async function createInitialUser() {
  try {
    console.log("Connecting to MongoDB...")
    await mongoose.connect(MONGODB_URI)
    console.log("Connected to MongoDB successfully")

    const User = mongoose.model("User", UserSchema)
    const Balance = mongoose.model("Balance", BalanceSchema)

    // Check if initial user already exists
    const existingUser = await User.findOne({ referralCode: "AAAAAA" })
    if (existingUser) {
      console.log("Initial user with referral code AAAAAA already exists")
      return
    }

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

    console.log("Initial user created:", initialUser._id)

    // Create balance for initial user
    await Balance.create({
      userId: initialUser._id,
    })

    console.log("Initial balance created for admin user")
    console.log("You can now use referral code: AAAAAA to register new users")
  } catch (error) {
    console.error("Error creating initial user:", error)
  } finally {
    await mongoose.disconnect()
    console.log("Disconnected from MongoDB")
  }
}

createInitialUser()
