import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import CommissionRule from "@/models/CommissionRule"
import Settings from "@/models/Settings"
import Notification from "@/models/Notification"

export async function calculateUserLevel(userId: string): Promise<number> {
  const [user, settings, directReferrals] = await Promise.all([
    User.findById(userId),
    Settings.findOne(),
    User.find({ referredBy: userId }).select("depositTotal"),
  ])

  if (!user) return 0

  const minDeposit = settings?.gating?.minDeposit ?? 30
  const activeDepositThreshold = settings?.gating?.activeMinDeposit ?? 80

  if (user.depositTotal < minDeposit) {
    if (user.level !== 0) {
      await User.updateOne({ _id: userId }, { level: 0 })
    }
    return 0
  }

  const activeDirectReferrals = directReferrals.filter((member) => member.depositTotal >= activeDepositThreshold)
  const activeCount = activeDirectReferrals.length
  const directSalesVolume = directReferrals.reduce((sum, member) => sum + member.depositTotal, 0)

  const rules = await CommissionRule.find().sort({ level: 1 })

  let userLevel = 1
  for (const rule of rules) {
    if (activeCount >= rule.activeMin) {
      userLevel = rule.level
    } else {
      break
    }
  }

  if (userLevel >= 5 && activeCount < 35) {
    userLevel = 4
  }

  if (userLevel >= 5 && directSalesVolume < 7000) {
    userLevel = 4
  }

  if (user.level !== userLevel) {
    await User.updateOne({ _id: userId }, { level: userLevel })

    if (userLevel > user.level) {
      await Notification.create({
        userId,
        kind: "level-up",
        title: "Level Up!",
        body: `Congratulations! You've reached Level ${userLevel}`,
      })
    }
  }

  return userLevel
}

export async function processReferralCommission(referredUserId: string, depositAmount: number) {
  const referredUser = await User.findById(referredUserId)
  if (!referredUser?.referredBy) return

  const referrer = await User.findById(referredUser.referredBy)
  if (!referrer) return

  const settings = await Settings.findOne()
  if (!settings) return

  // Check if deposit meets minimum threshold for commission
  if (depositAmount < settings.commission.startAtDeposit) return

  // Calculate referrer's current level
  const referrerLevel = await calculateUserLevel(referrer._id.toString())

  // Get commission rule for referrer's level
  const commissionRule = await CommissionRule.findOne({ level: referrerLevel })
  const commissionPct = commissionRule?.directPct || settings.commission.baseDirectPct

  // Calculate commission
  const commissionAmount = (depositAmount * commissionPct) / 100

  // Credit commission to referrer
  await Balance.updateOne(
    { userId: referrer._id },
    {
      $inc: {
        current: commissionAmount,
        totalBalance: commissionAmount,
        totalEarning: commissionAmount,
      },
    },
  )

  // Create commission transaction
  await Transaction.create({
    userId: referrer._id,
    type: "commission",
    amount: commissionAmount,
    meta: {
      source: "referral",
      referredUserId,
      depositAmount,
      commissionPct,
      level: referrerLevel,
    },
  })

  // Create notification for referrer
  await Notification.create({
    userId: referrer._id,
    kind: "referral-joined",
    title: "Referral Commission Earned",
    body: `You earned $${commissionAmount.toFixed(2)} commission from ${referredUser.name}'s deposit`,
  })

  // Check for joining bonus
  if (depositAmount >= settings.joiningBonus.threshold) {
    const bonusAmount = (depositAmount * settings.joiningBonus.pct) / 100

    // Credit bonus to referred user
    await Balance.updateOne(
      { userId: referredUserId },
      {
        $inc: {
          current: bonusAmount,
          totalBalance: bonusAmount,
          totalEarning: bonusAmount,
        },
      },
    )

    // Create bonus transaction
    await Transaction.create({
      userId: referredUserId,
      type: "bonus",
      amount: bonusAmount,
      meta: {
        source: "joining_bonus",
        depositAmount,
        bonusPct: settings.joiningBonus.pct,
      },
    })
  }
}

export async function buildTeamTree(userId: string, maxDepth = 5): Promise<any> {
  const user = await User.findById(userId).select("name email referralCode level depositTotal isActive createdAt")
  if (!user) return null

  if (maxDepth <= 0) return user

  const directReferrals = await User.find({ referredBy: userId, depositTotal: { $gt: 0 } })
    .select("name email referralCode level depositTotal isActive createdAt")
    .sort({ createdAt: -1 })

  const children = []
  for (const referral of directReferrals) {
    const childTree = await buildTeamTree(referral._id.toString(), maxDepth - 1)
    if (childTree) {
      children.push(childTree)
    }
  }

  return {
    ...user.toObject(),
    children,
    directCount: directReferrals.length,
    activeCount: directReferrals.filter((r) => r.depositTotal >= 80).length,
  }
}

export async function getTeamStats(userId: string) {
  // Get all descendants (team members)
  const allTeamMembers = await getAllTeamMembers(userId)

  // Calculate team statistics
  const totalMembers = allTeamMembers.length
  const activeMembers = allTeamMembers.filter((member) => member.depositTotal >= 80).length
  const totalTeamDeposits = allTeamMembers.reduce((sum, member) => sum + member.depositTotal, 0)
  const totalTeamEarnings = allTeamMembers.reduce((sum, member) => sum + member.roiEarnedTotal, 0)

  // Get direct referrals
  const directReferrals = await User.find({ referredBy: userId })
  const directActive = directReferrals.filter((member) => member.depositTotal >= 80).length

  return {
    totalMembers,
    activeMembers,
    directReferrals: directReferrals.length,
    directActive,
    totalTeamDeposits,
    totalTeamEarnings,
    levels: {
      level1: directReferrals.length,
      level2: await User.countDocuments({ referredBy: { $in: directReferrals.map((r) => r._id) } }),
      // Could expand to more levels as needed
    },
  }
}

async function getAllTeamMembers(userId: string, visited = new Set()): Promise<any[]> {
  if (visited.has(userId)) return []
  visited.add(userId)

  const directReferrals = await User.find({ referredBy: userId })
  let allMembers = [...directReferrals]

  for (const referral of directReferrals) {
    const subTeam = await getAllTeamMembers(referral._id.toString(), visited)
    allMembers = allMembers.concat(subTeam)
  }

  return allMembers
}
