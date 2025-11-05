import mongoose, { type ClientSession } from "mongoose"

import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import BonusPayout, { type BonusPayoutType } from "@/models/Payout"
import {
  ACTIVE_DEPOSIT_THRESHOLD,
  DEPOSIT_L1_PERCENT,
  DEPOSIT_L2_PERCENT_ACTIVE,
  DEPOSIT_SELF_PERCENT_ACTIVE,
  TEAM_EARN_L1_PERCENT,
  TEAM_EARN_L2_PERCENT,
} from "@/lib/constants/bonuses"

function asObjectId(id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id
}

function roundAmount(amount: number): number {
  return Math.round(amount * 10000) / 10000
}

interface CreatePayoutInput {
  payerUserId: mongoose.Types.ObjectId
  receiverUserId: mongoose.Types.ObjectId
  type: BonusPayoutType
  baseAmount: number
  percent: number
  sourceTxId: string
  occurredAt: Date
  session: ClientSession
  immediate?: boolean
  meta?: Record<string, unknown>
}

async function createPayout({
  payerUserId,
  receiverUserId,
  type,
  baseAmount,
  percent,
  sourceTxId,
  occurredAt,
  session,
  immediate = false,
  meta = {},
}: CreatePayoutInput) {
  if (percent <= 0 || baseAmount <= 0) {
    return { created: false, amount: 0 }
  }

  const payoutAmount = roundAmount(baseAmount * percent)
  if (payoutAmount <= 0) {
    return { created: false, amount: 0 }
  }

  const filter = { receiverUserId, type, sourceTxId }
  const upsertResult = await BonusPayout.updateOne(
    filter,
    {
      $setOnInsert: {
        payerUserId,
        receiverUserId,
        type,
        baseAmount,
        percent,
        payoutAmount,
        sourceTxId,
        status: immediate ? "CLAIMED" : "PENDING",
        claimedAt: immediate ? occurredAt : null,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      },
    },
    { upsert: true, session },
  )

  const inserted = Number(upsertResult.upsertedCount ?? 0) > 0

  if (!inserted) {
    return { created: false, amount: payoutAmount }
  }

  if (immediate) {
    await Balance.updateOne(
      { userId: receiverUserId },
      {
        $inc: {
          current: payoutAmount,
          totalBalance: payoutAmount,
          totalEarning: payoutAmount,
        },
        $setOnInsert: {
          lockedCapital: 0,
          lockedCapitalLots: [],
          staked: 0,
          pendingWithdraw: 0,
          teamRewardsClaimed: 0,
          teamRewardsAvailable: 0,
          teamRewardsLastClaimedAt: null,
        },
      },
      { upsert: true, session },
    )

    const payoutDoc = await BonusPayout.findOne(filter, null, { session })
    const payoutId = payoutDoc?._id ? payoutDoc._id.toString() : null

    await Transaction.create(
      [
        {
          userId: receiverUserId,
          type: type === "DEPOSIT_BONUS_SELF" ? "bonus" : "commission",
          amount: payoutAmount,
          status: "approved",
          claimable: false,
          meta: {
            source:
              type === "DEPOSIT_BONUS_SELF"
                ? "deposit_bonus_self"
                : type === "DEPOSIT_L1"
                  ? "deposit_referral_l1"
                  : "deposit_referral_l2",
            baseAmount,
            percent: percent * 100,
            payoutId,
            sourceTxId,
            ...meta,
          },
          createdAt: occurredAt,
          updatedAt: occurredAt,
        },
      ],
      { session },
    )
  }

  return { created: true, amount: payoutAmount }
}

interface DepositRewardsOptions {
  depositTransactionId: string
  depositAt?: Date
  session?: ClientSession
}

export interface DepositRewardOutcome {
  activated: boolean
  selfBonus: number
  l1Bonus: number
  l2Bonus: number
  depositorActive: boolean
  lifetimeDeposit: number
  l1UserId: string | null
  l2UserId: string | null
}

export async function applyDepositRewards(
  userId: string,
  depositAmount: number,
  options: DepositRewardsOptions,
): Promise<DepositRewardOutcome> {
  const session = options.session ?? (await mongoose.startSession())
  const occurredAt = options.depositAt ?? new Date()

  const run = async () => {
    const depositor = await User.findById(userId, null, { session })
    if (!depositor) {
      throw new Error("Depositor not found")
    }

    const baseAmount = Number(depositAmount)
    const lifetimeAfter = Number(depositor.depositTotal ?? 0)
    const lifetimeBefore = Math.max(0, lifetimeAfter - baseAmount)
    const wasActive = lifetimeBefore >= ACTIVE_DEPOSIT_THRESHOLD
    const depositorActive = lifetimeAfter >= ACTIVE_DEPOSIT_THRESHOLD
    const qualifiesForSelfBonus = depositorActive && (wasActive || lifetimeBefore > 0)
    const qualifiesForL1 = wasActive || !depositorActive

    let selfBonus = 0
    let l1Bonus = 0
    let l2Bonus = 0
    let l1UserId: string | null = null
    let l2UserId: string | null = null

    if (baseAmount > 0) {
      const depositorObjectId = asObjectId(depositor._id as mongoose.Types.ObjectId)

      const selfResult = await createPayout({
        payerUserId: depositorObjectId,
        receiverUserId: depositorObjectId,
        type: "DEPOSIT_BONUS_SELF",
        baseAmount,
        percent: qualifiesForSelfBonus ? DEPOSIT_SELF_PERCENT_ACTIVE : 0,
        sourceTxId: options.depositTransactionId,
        occurredAt,
        session,
        immediate: true,
      })
      selfBonus = selfResult.amount

      if (depositor.referredBy) {
        const l1User = await User.findById(depositor.referredBy, null, { session })
        if (l1User) {
          const l1ObjectId = asObjectId(l1User._id as mongoose.Types.ObjectId)
          l1UserId = l1ObjectId.toHexString()
          const l1Result = await createPayout({
            payerUserId: depositorObjectId,
            receiverUserId: l1ObjectId,
            type: "DEPOSIT_L1",
            baseAmount,
            percent: qualifiesForL1 ? DEPOSIT_L1_PERCENT : 0,
            sourceTxId: options.depositTransactionId,
            occurredAt,
            session,
            immediate: true,
            meta: { depositorUserId: depositorObjectId.toHexString() },
          })
          l1Bonus = l1Result.amount

          if (l1User.referredBy) {
            const l2User = await User.findById(l1User.referredBy, null, { session })
            if (l2User) {
              const l2ObjectId = asObjectId(l2User._id as mongoose.Types.ObjectId)
              l2UserId = l2ObjectId.toHexString()
              const l2Result = await createPayout({
                payerUserId: depositorObjectId,
                receiverUserId: l2ObjectId,
                type: "DEPOSIT_L2",
                baseAmount,
                percent: wasActive ? DEPOSIT_L2_PERCENT_ACTIVE : 0,
                sourceTxId: options.depositTransactionId,
                occurredAt,
                session,
                immediate: true,
                meta: { depositorUserId: depositorObjectId.toHexString() },
              })
              l2Bonus = l2Result.amount
            }
          }
        }
      }
    }

    const activated = !wasActive && depositorActive

    return {
      activated,
      selfBonus,
      l1Bonus,
      l2Bonus,
      depositorActive,
      lifetimeDeposit: lifetimeAfter,
      l1UserId,
      l2UserId,
    }
  }

  if (options.session) {
    return run()
  }

  try {
    let outcome: DepositRewardOutcome | null = null
    await session.withTransaction(async () => {
      outcome = await run()
    })
    if (!outcome) {
      throw new Error("Deposit reward outcome missing")
    }
    return outcome
  } finally {
    session.endSession().catch(() => null)
  }
}

interface TeamEarningOptions {
  earningTransactionId: string
  earningAt?: Date
  session?: ClientSession
}

export async function createTeamEarningPayouts(
  userId: string,
  earningAmount: number,
  options: TeamEarningOptions,
) {
  const session = options.session ?? (await mongoose.startSession())
  const occurredAt = options.earningAt ?? new Date()

  const run = async () => {
    const earner = await User.findById(userId, null, { session })
    if (!earner) {
      return { created: 0 }
    }

    const baseAmount = Number(earningAmount)
    if (baseAmount <= 0) {
      return { created: 0 }
    }

    const earnerObjectId = asObjectId(earner._id as mongoose.Types.ObjectId)
    let createdCount = 0

    const l1User = earner.referredBy
      ? await User.findById(earner.referredBy, null, { session })
      : null
    const l2User = l1User?.referredBy
      ? await User.findById(l1User.referredBy, null, { session })
      : null

    if (l1User) {
      const l1Result = await createPayout({
        payerUserId: earnerObjectId,
        receiverUserId: asObjectId(l1User._id as mongoose.Types.ObjectId),
        type: "TEAM_EARN_L1",
        baseAmount,
        percent: TEAM_EARN_L1_PERCENT,
        sourceTxId: options.earningTransactionId,
        occurredAt,
        session,
      })
      if (l1Result.created) createdCount += 1
    }

    if (l2User) {
      const l2Result = await createPayout({
        payerUserId: earnerObjectId,
        receiverUserId: asObjectId(l2User._id as mongoose.Types.ObjectId),
        type: "TEAM_EARN_L2",
        baseAmount,
        percent: TEAM_EARN_L2_PERCENT,
        sourceTxId: options.earningTransactionId,
        occurredAt,
        session,
      })
      if (l2Result.created) createdCount += 1
    }

    return { created: createdCount }
  }

  if (options.session) {
    return run()
  }

  try {
    let outcome: { created: number } | null = null
    await session.withTransaction(async () => {
      outcome = await run()
    })
    if (!outcome) {
      return { created: 0 }
    }
    return outcome
  } finally {
    session.endSession().catch(() => null)
  }
}

interface ClaimOutcome {
  claimedTotal: number
  claimedCount: number
  items: {
    id: string
    type: BonusPayoutType
    amount: number
    baseAmount: number
    percent: number
    payerUserId: string
    sourceTxId: string
    createdAt: Date
    claimedAt: Date
  }[]
}

export async function claimTeamEarningPayouts(userId: string): Promise<ClaimOutcome> {
  const session = await mongoose.startSession()
  try {
    let outcome: ClaimOutcome | null = null
    await session.withTransaction(async () => {
      const receiverId = asObjectId(userId)
      const pendingPayouts = await BonusPayout.find(
        {
          receiverUserId: receiverId,
          status: "PENDING",
          type: { $in: ["TEAM_EARN_L1", "TEAM_EARN_L2"] },
        },
        null,
        { session },
      )
        .sort({ createdAt: 1, _id: 1 })
        .exec()

      if (pendingPayouts.length === 0) {
        outcome = { claimedTotal: 0, claimedCount: 0, items: [] }
        return
      }

      const now = new Date()
      const items: ClaimOutcome["items"] = []
      let total = 0

      for (const payout of pendingPayouts) {
        const updated = await BonusPayout.updateOne(
          { _id: payout._id, status: "PENDING" },
          { $set: { status: "CLAIMED", claimedAt: now, updatedAt: now } },
          { session },
        )

        if (updated.modifiedCount === 0) {
          continue
        }

        const amount = Number(payout.payoutAmount ?? 0)
        total += amount
        items.push({
          id: payout._id instanceof mongoose.Types.ObjectId ? payout._id.toHexString() : String(payout._id),
          type: payout.type,
          amount,
          baseAmount: Number(payout.baseAmount ?? 0),
          percent: Number(payout.percent ?? 0) * 100,
          payerUserId: payout.payerUserId.toString(),
          sourceTxId: payout.sourceTxId,
          createdAt: payout.createdAt,
          claimedAt: now,
        })

        await Transaction.create(
          [
            {
              userId: receiverId,
              type: "teamReward",
              amount,
              status: "approved",
              claimable: false,
              meta: {
                source: "team_earning_claim",
                payoutId: payout._id,
                baseAmount: Number(payout.baseAmount ?? 0),
                percent: Number(payout.percent ?? 0) * 100,
                payerUserId: payout.payerUserId.toString(),
                sourceTxId: payout.sourceTxId,
                payoutType: payout.type,
              },
              createdAt: now,
              updatedAt: now,
            },
          ],
          { session },
        )
      }

      if (items.length === 0) {
        outcome = { claimedTotal: 0, claimedCount: 0, items: [] }
        return
      }

      await Balance.updateOne(
        { userId: receiverId },
        {
          $inc: {
            current: total,
            totalBalance: total,
            totalEarning: total,
            teamRewardsClaimed: total,
          },
          $set: {
            teamRewardsAvailable: 0,
            teamRewardsLastClaimedAt: now,
          },
        },
        { upsert: true, session },
      )

      outcome = {
        claimedTotal: roundAmount(total),
        claimedCount: items.length,
        items,
      }
    })

    if (!outcome) {
      throw new Error("Claim outcome missing")
    }

    return outcome
  } finally {
    session.endSession().catch(() => null)
  }
}

export async function getPendingTeamEarnings(userId: string) {
  const receiverId = asObjectId(userId)
  const payouts = await BonusPayout.find({
    receiverUserId: receiverId,
    status: "PENDING",
    type: { $in: ["TEAM_EARN_L1", "TEAM_EARN_L2"] },
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean()

  return payouts.map((payout) => ({
    id: payout._id.toString(),
    type: payout.type,
    payerUserId: payout.payerUserId.toString(),
    baseAmount: Number(payout.baseAmount ?? 0),
    percent: Number(payout.percent ?? 0) * 100,
    payoutAmount: Number(payout.payoutAmount ?? 0),
    createdAt: payout.createdAt,
    sourceTxId: payout.sourceTxId,
  }))
}

export async function getClaimedTeamEarnings(userId: string) {
  const receiverId = asObjectId(userId)
  const payouts = await BonusPayout.find({
    receiverUserId: receiverId,
    status: "CLAIMED",
    type: { $in: ["TEAM_EARN_L1", "TEAM_EARN_L2"] },
  })
    .sort({ claimedAt: -1, createdAt: -1 })
    .lean()

  return payouts.map((payout) => ({
    id: payout._id.toString(),
    type: payout.type,
    payerUserId: payout.payerUserId.toString(),
    baseAmount: Number(payout.baseAmount ?? 0),
    percent: Number(payout.percent ?? 0) * 100,
    payoutAmount: Number(payout.payoutAmount ?? 0),
    createdAt: payout.createdAt,
    claimedAt: payout.claimedAt ?? payout.updatedAt ?? payout.createdAt,
    sourceTxId: payout.sourceTxId,
  }))
}

export function isUserActiveFromDeposits(lifetimeDeposit: number): boolean {
  return lifetimeDeposit >= ACTIVE_DEPOSIT_THRESHOLD
}

export { ACTIVE_DEPOSIT_THRESHOLD }
