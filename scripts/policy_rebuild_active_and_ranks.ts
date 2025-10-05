import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import dbConnect from "@/lib/mongodb"
import Settings from "@/models/Settings"
import User from "@/models/User"
import Transaction from "@/models/Transaction"
import { calculateUserLevel } from "@/lib/utils/commission"
import { inferSponsorLink, resolveActivationThreshold } from "@/lib/utils/policy"

type NullableDate = Date | null | undefined

type NullableNumber = number | null | undefined

function formatDateStamp(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

function toIsoOrNull(value: NullableDate): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function datesEqual(a: NullableDate, b: NullableDate): boolean {
  const isoA = toIsoOrNull(a)
  const isoB = toIsoOrNull(b)
  return isoA === isoB
}

function numbersEqual(a: NullableNumber, b: NullableNumber): boolean {
  if (a == null && b == null) return true
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < Number.EPSILON
  }
  return false
}

async function main() {
  console.log("🔄 Rebuilding user activation and ranks policy state...")
  await dbConnect()

  const settings = await Settings.findOne()
  const threshold = resolveActivationThreshold(settings)
  const adjustmentReason = `policy_update_${formatDateStamp(new Date())}`

  const users = await User.find({})
    .select("isActive level referredBy first_qualifying_deposit_at first_qualifying_deposit_amount")
    .lean()

  let processed = 0
  let updatedUsers = 0
  let activatedUsers = 0
  let levelChanges = 0

  for (const user of users) {
    processed += 1

    const previousFirstAt = (user.first_qualifying_deposit_at as Date | null | undefined) ?? null
    const previousFirstAmount = (user.first_qualifying_deposit_amount as number | null | undefined) ?? null
    const previousActive = Boolean(user.isActive)
    const previousLevel = typeof user.level === "number" ? user.level : 0

    const approvedDeposits = await Transaction.find({
      userId: user._id,
      type: "deposit",
      status: "approved",
      amount: { $gte: threshold },
    })
      .sort({ createdAt: 1 })
      .lean()

    let firstQualifyingDeposit: (typeof approvedDeposits)[number] | null = null
    for (const deposit of approvedDeposits) {
      if (inferSponsorLink(deposit.meta, user)) {
        firstQualifyingDeposit = deposit
        break
      }
    }

    const desiredFirstAt = firstQualifyingDeposit?.createdAt ?? null
    const desiredFirstAmount = firstQualifyingDeposit?.amount ?? null
    const desiredActive = Boolean(firstQualifyingDeposit)

    const updates: Record<string, unknown> = {}

    if (!datesEqual(previousFirstAt, desiredFirstAt)) {
      updates.first_qualifying_deposit_at = desiredFirstAt
    }

    if (!numbersEqual(previousFirstAmount, desiredFirstAmount)) {
      updates.first_qualifying_deposit_amount = desiredFirstAmount
    }

    if (previousActive !== desiredActive) {
      updates.isActive = desiredActive
    }

    const changed = Object.keys(updates).length > 0

    if (changed) {
      await User.updateOne({ _id: user._id }, { $set: updates })
      updatedUsers += 1
      if (desiredActive && !previousActive) {
        activatedUsers += 1
      }
    }

    const newLevel = await calculateUserLevel(user._id.toString(), { suppressNotifications: true })
    if (newLevel !== previousLevel) {
      levelChanges += 1
    }

    if (changed || newLevel !== previousLevel) {
      await Transaction.create({
        userId: user._id,
        type: "adjust",
        amount: 0,
        meta: {
          adjustment_reason: adjustmentReason,
          previous: {
            isActive: previousActive,
            level: previousLevel,
            firstQualifyingDepositAt: toIsoOrNull(previousFirstAt),
            firstQualifyingDepositAmount: previousFirstAmount ?? null,
          },
          next: {
            isActive: typeof updates.isActive === "boolean" ? updates.isActive : previousActive,
            level: newLevel,
            firstQualifyingDepositAt: toIsoOrNull(
              updates.first_qualifying_deposit_at as NullableDate ?? previousFirstAt,
            ),
            firstQualifyingDepositAmount:
              (updates.first_qualifying_deposit_amount as NullableNumber) ?? previousFirstAmount ?? null,
          },
          qualifying_deposit_id: firstQualifyingDeposit?._id?.toString() ?? null,
        },
      })
    }
  }

  console.log(
    `✅ Policy rebuild complete. Processed ${processed} users, updated ${updatedUsers}, activated ${activatedUsers}, rank adjustments ${levelChanges}.`,
  )

  process.exit(0)
}

main().catch((error) => {
  console.error("❌ Policy rebuild failed", error)
  process.exit(1)
})
