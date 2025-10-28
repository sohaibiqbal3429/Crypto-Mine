import "dotenv/config"

import dbConnect from "@/lib/mongodb"
import Settings from "@/models/Settings"
import CommissionRule from "@/models/CommissionRule"

async function run() {
  await dbConnect()

  const TARGET_PCT = 15

  // Update Settings.commission.baseDirectPct
  const settings = await Settings.findOne()
  if (!settings) {
    await Settings.create({
      commission: { baseDirectPct: TARGET_PCT },
    } as any)
    console.log(`[migrate] Settings created with baseDirectPct=${TARGET_PCT}%`)
  } else {
    const current = Number((settings as any)?.commission?.baseDirectPct)
    if (!Number.isFinite(current) || current !== TARGET_PCT) {
      await Settings.updateOne({}, { $set: { "commission.baseDirectPct": TARGET_PCT } })
      console.log(`[migrate] Settings updated: baseDirectPct ${current ?? "<unset>"} -> ${TARGET_PCT}`)
    } else {
      console.log(`[migrate] Settings already at ${TARGET_PCT}% — no change`)
    }
  }

  // Update all CommissionRule.directPct to 15
  const res = await CommissionRule.updateMany(
    { directPct: { $ne: TARGET_PCT } },
    { $set: { directPct: TARGET_PCT } },
  )
  console.log(
    `[migrate] CommissionRule directPct updated: matched=${res.matchedCount ?? (res as any).n} modified=${res.modifiedCount ?? (res as any).nModified}`,
  )

  console.log("[migrate] Done. New deposits will pay 15% direct commission.")
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[migrate] Error:", err)
    process.exit(1)
  })

