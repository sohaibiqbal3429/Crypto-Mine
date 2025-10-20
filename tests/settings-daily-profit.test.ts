import assert from "node:assert/strict"
import test from "node:test"

process.env.SEED_IN_MEMORY = "true"

import { getDailyProfitPercent, updateDailyProfitPercent } from "@/lib/services/settings"
import { calculateMiningProfit } from "@/lib/utils/referral"

test.after(async () => {
  await updateDailyProfitPercent("1.50")
})

test("daily profit percent defaults to 1.5% in seeded environments", async () => {
  const percent = await getDailyProfitPercent()
  assert.equal(percent, 1.5)
})

test("updating the daily profit percent persists the new value", async () => {
  const updated = await updateDailyProfitPercent("2.25")
  assert.equal(updated, 2.25)

  const reread = await getDailyProfitPercent()
  assert.equal(reread, 2.25)
})

test("calculateMiningProfit returns $1.50 for a $100 base at 1.5%", () => {
  const profit = calculateMiningProfit(100, 1.5)
  assert.equal(profit, 1.5)
})
