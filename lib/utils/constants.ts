// Application constants
export const APP_CONFIG = {
  name: "Mintmine Pro",
  description: "Advanced cryptocurrency mining platform",
  version: "1.0.0",
  supportEmail: "Mintminepro@gmail.com",
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
} as const

// Mining constants
export const MINING_CONFIG = {
  cooldownHours: 24,
  baseReward: 0.5,
  maxReward: 2.0,
  levelMultiplier: 0.1,
  maxLevel: 10,
} as const

// Transaction constants
export const TRANSACTION_CONFIG = {
  minDeposit: 80,
  maxDeposit: 50000,
  minWithdraw: 10,
  maxWithdraw: 10000,
  withdrawFee: 0.02, // 2%
  processingTime: {
    deposit: "5-30 minutes",
    withdraw: "24-48 hours",
  },
} as const

// Staking constants
export const STAKING_CONFIG = {
  pools: [
    { id: "30d", name: "30 Days", apy: 12.5, minStake: 100, lockDays: 30 },
    { id: "90d", name: "90 Days", apy: 18.0, minStake: 250, lockDays: 90 },
    { id: "365d", name: "1 Year", apy: 25.0, minStake: 500, lockDays: 365 },
  ],
} as const

// Level system constants
export const LEVEL_CONFIG = {
  requirements: [
    { level: 0, depositRequired: 0, activeMembersRequired: 0 },
    { level: 1, depositRequired: 0, activeMembersRequired: 5 },
    { level: 2, depositRequired: 0, activeMembersRequired: 10 },
    { level: 3, depositRequired: 0, activeMembersRequired: 15 },
    { level: 4, depositRequired: 0, activeMembersRequired: 23 },
    { level: 5, depositRequired: 0, activeMembersRequired: 30 },
  ],
  perks: {
    directCommission: {
      1: "15% direct commission + 1% Team A daily profit share",
      2: "8% direct commission + 1% daily profit share across Teams A–C",
      3: "8% direct commission with 8% team commission + 2% team reward across Teams A–D",
      4: "9% direct commission + 2% team reward; $200 bonus when monthly direct sales reach 2,200 USDT",
      5: "10% direct commission + 2% team reward; $400 monthly salary when direct sales reach 4,500 USDT",
    },
    salaryRequirement: {
      activeMembers: 30,
      directSales: 4500,
      payout: 400,
    },
  },
} as const

// Commission structure
export const COMMISSION_CONFIG = {
  levels: [
    { level: 1, percentage: 0.1 }, // 10% direct referral
    { level: 2, percentage: 0.05 }, // 5% second level
    { level: 3, percentage: 0.03 }, // 3% third level
    { level: 4, percentage: 0.02 }, // 2% fourth level
    { level: 5, percentage: 0.01 }, // 1% fifth level
  ],
  maxLevels: 5,
} as const

// OTP constants
export const OTP_CONFIG = {
  length: 6,
  expiryMinutes: 10,
  maxAttempts: 5,
  resendCooldown: 60, // seconds
  purposes: ["registration", "login", "password-reset", "withdrawal"] as const,
} as const

// Supported countries
export const SUPPORTED_COUNTRIES = [
  { code: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "+86", name: "China", flag: "🇨🇳" },
  { code: "+91", name: "India", flag: "🇮🇳" },
] as const

// API endpoints
export const API_ENDPOINTS = {
  auth: {
    login: "/api/auth/login",
    register: "/api/auth/register",
    logout: "/api/auth/logout",
    me: "/api/auth/me",
    resetPassword: "/api/auth/reset-password",
    sendOTP: "/api/auth/send-otp",
    verifyOTP: "/api/auth/verify-otp",
  },
  dashboard: "/api/dashboard",
  mining: {
    click: "/api/mining/click",
  },
  wallet: {
    deposit: "/api/wallet/deposit",
    withdraw: "/api/wallet/withdraw",
  },
  transactions: "/api/transactions",
  team: "/api/team/structure",
} as const

// Status constants
export const STATUS = {
  transaction: {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    PROCESSING: "processing",
    COMPLETED: "completed",
  },
  user: {
    ACTIVE: "active",
    INACTIVE: "inactive",
    SUSPENDED: "suspended",
    VERIFIED: "verified",
  },
} as const

// Error messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: "You are not authorized to perform this action",
  INVALID_CREDENTIALS: "Invalid email or password",
  USER_NOT_FOUND: "User not found",
  INVALID_OTP: "Invalid or expired OTP code",
  INSUFFICIENT_BALANCE: "Insufficient balance",
  INVALID_REFERRAL: "Invalid referral code",
  MINING_COOLDOWN: "Mining is on cooldown. Please wait before mining again",
  NETWORK_ERROR: "Network error. Please try again",
  VALIDATION_ERROR: "Please check your input and try again",
} as const
