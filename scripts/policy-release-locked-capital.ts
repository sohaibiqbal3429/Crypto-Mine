import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import { partitionLotsByMaturity } from "@/lib/utils/locked-capital"

async function main() {
  await dbConnect()

  const now = new Date()

  const balances = await Balance.find({
    lockedCapitalLots: {
      $elemMatch: {
        released: { $ne: true },
        lockEnd: { $lte: now },
      },
    },
  })

  let processed = 0
  let totalReleased = 0

  for (const balance of balances) {
    const { matured } = partitionLotsByMaturity(balance.lockedCapitalLots, now)
    const releasableLots = matured.filter((lot) => !lot.released)
    if (!releasableLots.length) continue

    const releaseAmount = releasableLots.reduce((sum, lot) => sum + lot.amount, 0)
    const decrementAmount = Math.min(releaseAmount, balance.lockedCapital)

    await Balance.updateOne(
      { _id: balance._id },
      {
        $set: {
          "lockedCapitalLots.$[lot].released": true,
          "lockedCapitalLots.$[lot].releasedAt": now,
        },
        $inc: { lockedCapital: -decrementAmount },
      },
      {
        arrayFilters: [
          {
            "lot.released": { $ne: true },
            "lot.lockEnd": { $lte: now },
          },
        ],
      },
    )

    processed += 1
    totalReleased += decrementAmount
  }

  console.log(`Released $${totalReleased.toFixed(2)} in locked capital across ${processed} balance(s).`)
  process.exit(0)
}

main().catch((error) => {
  console.error("Failed to release locked capital", error)
  process.exit(1)
})
