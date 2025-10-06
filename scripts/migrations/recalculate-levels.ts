import "dotenv/config"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Transaction from "@/models/Transaction"
import { recalculateAllUserLevels } from "@/lib/utils/commission"

const QUALIFYING_DEPOSIT_AMOUNT = 80

async function ensureQualificationFlags() {
  const qualifyingDeposits = await Transaction.aggregate<{
    _id: string
    firstQualifiedAt: Date
  }>([
    {
      $match: {
        type: "deposit",
        status: "approved",
        amount: { $gte: QUALIFYING_DEPOSIT_AMOUNT },
      },
    },
    {
      $group: {
        _id: "$userId",
        firstQualifiedAt: { $min: "$createdAt" },
      },
    },
  ])

  let updated = 0
  for (const deposit of qualifyingDeposits) {
    if (!deposit?._id) continue

    const updateResult = await User.updateOne(
      {
        _id: deposit._id,
        $or: [{ qualified: { $ne: true } }, { qualifiedAt: { $exists: false } }, { qualifiedAt: null }],
      },
      {
        $set: {
          qualified: true,
          qualifiedAt: deposit.firstQualifiedAt ?? new Date(),
        },
      },
    )

    if (updateResult.modifiedCount > 0) {
      updated += 1
    }
  }

  return { updated, total: qualifyingDeposits.length }
}

async function run() {
  await dbConnect()

  console.log("Recomputing qualification flags based on approved deposits ≥ $80...")
  const qualificationSummary = await ensureQualificationFlags()
  console.log(
    `✓ Qualification flags processed for ${qualificationSummary.total} users (updated ${qualificationSummary.updated})`,
  )

  console.log("Recalculating user levels with referral progression resets...")
  await recalculateAllUserLevels({ persist: true, notify: false })
  console.log("✓ User levels recalculated successfully")
}

run()
  .then(() => {
    console.log("Migration complete")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Migration failed", error)
    process.exit(1)
  })
