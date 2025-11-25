import assert from "node:assert/strict"
import test from "node:test"
import { randomBytes } from "node:crypto"

process.env.SEED_IN_MEMORY = "true"
process.env.APP_SETTINGS_ENCRYPTION_KEY = "unit-test-secret"
process.env.DEPOSIT_WALLET_ADDRESS_1 = "0x1111111111111111111111111111111111111111"
process.env.DEPOSIT_WALLET_ADDRESS_2 = "0x2222222222222222222222222222222222222222"
process.env.DEPOSIT_WALLET_ADDRESS_3 = "TNDh9bU1Wq6sLwVh5C3p2zYb8wQ7rNs5tR"

import {
  getPublicWalletAddresses,
  getWalletSettingsFromEnv,
  updateWalletAddressSettings,
  invalidateWalletSettingsCache,
  WalletSettingsRateLimitError,
} from "@/lib/services/app-settings"
import dbConnect from "@/lib/mongodb"

const ADMIN_ID = "507f1f77bcf86cd799439011"
const RATE_LIMIT_ADMIN_ID = "507f1f77bcf86cd799439012"

const WALLET_ID_MAP: Record<string, "wallet1" | "wallet2" | "wallet3"> = {
  bep20_primary: "wallet1",
  bep20_secondary: "wallet2",
  trc20: "wallet3",
}

function makeEthAddress() {
  return `0x${randomBytes(20).toString("hex")}`
}

function makeTronAddress() {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  let value = "T"
  while (value.length < 34) {
    const [byte] = randomBytes(1)
    value += alphabet[byte % alphabet.length]
  }
  return value.slice(0, 34)
}

async function resetState() {
  await dbConnect()
  invalidateWalletSettingsCache()
}

test("public wallet addresses fall back to environment defaults", async () => {
  await resetState()

  const wallets = await getPublicWalletAddresses()
  assert.equal(wallets.length, 3)
  assert.equal(wallets[0]?.address, process.env.DEPOSIT_WALLET_ADDRESS_1)
  assert.equal(wallets[1]?.address, process.env.DEPOSIT_WALLET_ADDRESS_2)
  assert.equal(wallets[2]?.address, process.env.DEPOSIT_WALLET_ADDRESS_3)
})

test("admin fallback wallets expose environment values", () => {
  const wallets = getWalletSettingsFromEnv()
  assert.equal(wallets.length, 3)
  assert.equal(wallets[0]?.address, process.env.DEPOSIT_WALLET_ADDRESS_1)
  assert.equal(wallets[1]?.address, process.env.DEPOSIT_WALLET_ADDRESS_2)
  assert.equal(wallets[2]?.address, process.env.DEPOSIT_WALLET_ADDRESS_3)
  wallets.forEach((wallet) => {
    assert.equal(wallet.source, wallet.address ? "env" : "unset")
    assert.equal(wallet.updatedAt, null)
    assert.equal(wallet.updatedBy, null)
  })
})

test("updating wallet addresses persists values and overrides env", async () => {
  await resetState()

  const nextValues = {
    wallet1: makeEthAddress(),
    wallet2: makeEthAddress(),
    wallet3: makeTronAddress(),
  }

  const updated = await updateWalletAddressSettings({
    ...nextValues,
    adminId: ADMIN_ID,
    ipAddress: "203.0.113.10",
    reason: "Rotate hot wallets",
  })

  assert.equal(updated.length, 3)
  updated.forEach((wallet) => {
    const key = WALLET_ID_MAP[wallet.id]
    if (!key) return
    assert.equal(wallet.address, nextValues[key])
    assert.equal(wallet.source, "db")
  })

  await invalidateWalletSettingsCache()
  const publicWallets = await getPublicWalletAddresses()
  assert.deepEqual(publicWallets.map((wallet) => wallet.address), [
    nextValues.wallet1,
    nextValues.wallet2,
    nextValues.wallet3,
  ])
})

test("wallet updates are rate limited per admin", async () => {
  await resetState()

  for (let i = 0; i < 3; i += 1) {
    await updateWalletAddressSettings({
      wallet1: makeEthAddress(),
      wallet2: makeEthAddress(),
      wallet3: makeTronAddress(),
      adminId: RATE_LIMIT_ADMIN_ID,
      ipAddress: "198.51.100.20",
    })
  }

  await assert.rejects(
    () =>
      updateWalletAddressSettings({
        wallet1: makeEthAddress(),
        wallet2: makeEthAddress(),
        wallet3: makeTronAddress(),
        adminId: RATE_LIMIT_ADMIN_ID,
      }),
    WalletSettingsRateLimitError,
  )
})
