import { type FilterQuery } from "mongoose"

import dbConnect from "@/lib/mongodb"
import AppSetting from "@/models/AppSetting"
import AppSettingAudit, { type IAppSettingAudit } from "@/models/AppSettingAudit"
import Cache from "@/models/Cache"
import { encryptString, decryptString } from "@/lib/utils/encryption"

const WALLET_DESCRIPTORS = [
  {
    id: "bep20_primary",
    key: "wallet.address.1",
    label: "BEP20 (Address 1)",
    network: "BEP20",
    envKeys: ["DEPOSIT_WALLET_ADDRESS_1", "DEPOSIT_WALLET_ADRESS_1", "DEPOSIT_WALLET_ADDRESS"],
  },
  {
    id: "bep20_secondary",
    key: "wallet.address.2",
    label: "BEP20 (Address 2)",
    network: "BEP20",
    envKeys: ["DEPOSIT_WALLET_ADDRESS_2", "DEPOSIT_WALLET_ADRESS_2"],
  },
  {
    id: "trc20",
    key: "wallet.address.3",
    label: "TRC20",
    network: "TRC20",
    envKeys: ["DEPOSIT_WALLET_ADDRESS_3", "DEPOSIT_WALLET_ADRESS_3"],
  },
] as const

const CACHE_TTL_MS = 60_000
const RATE_LIMIT_MAX_CHANGES = 3
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_CACHE_PREFIX = "wallet-settings:rate-limit:"

interface WalletDescriptor {
  id: (typeof WALLET_DESCRIPTORS)[number]["id"]
  key: string
  label: string
  network: string
  envKeys: readonly string[]
}

interface WalletSettingAdminRecord {
  id: string
  key: string
  label: string
  network: string
  address: string
  source: "db" | "env" | "unset"
  updatedAt: string | null
  updatedBy: { id: string; name: string | null; email: string | null } | null
}

interface WalletSettingPublicRecord {
  id: string
  label: string
  network: string
  address: string
}

interface WalletSettingsSnapshot {
  admin: WalletSettingAdminRecord[]
  public: WalletSettingPublicRecord[]
}

let walletCache: { snapshot: WalletSettingsSnapshot; expiresAt: number } | null = null

function readEnvFallback(keys: readonly string[]): string | "" {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ""
}

function normalizeAddress(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

function decryptValueIfNeeded(value: string | undefined | null): string {
  if (!value) {
    return ""
  }

  try {
    return decryptString(value)
  } catch (error) {
    console.error("Failed to decrypt app setting value", error)
    throw new Error("Unable to decrypt stored configuration value")
  }
}

function computeAdminRecord(
  descriptor: WalletDescriptor,
  storedValue: string | undefined,
  source: "db" | "env" | "unset",
  updatedAt: Date | null,
  updatedBy: { _id?: unknown; name?: string | null; email?: string | null } | null,
): WalletSettingAdminRecord {
  const address = normalizeAddress(storedValue)
  return {
    id: descriptor.id,
    key: descriptor.key,
    label: descriptor.label,
    network: descriptor.network,
    address,
    source,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
    updatedBy: updatedBy && updatedBy._id
      ? {
          id: String(updatedBy._id),
          name: updatedBy.name ?? null,
          email: updatedBy.email ?? null,
        }
      : null,
  }
}

function computePublicRecords(adminRecords: WalletSettingAdminRecord[]): WalletSettingPublicRecord[] {
  return adminRecords
    .filter((record) => record.address)
    .map((record) => ({
      id: record.id,
      label: record.label,
      network: record.network,
      address: record.address,
    }))
}

async function loadWalletSettingsSnapshot(): Promise<WalletSettingsSnapshot> {
  const now = Date.now()
  if (walletCache && walletCache.expiresAt > now) {
    return walletCache.snapshot
  }

  await dbConnect()

  const docs = await AppSetting.find({
    key: { $in: WALLET_DESCRIPTORS.map((descriptor) => descriptor.key) },
  })
    .populate({ path: "updatedBy", select: { name: 1, email: 1 } })
    .lean()

  const docMap = new Map<string, (typeof docs)[number]>()
  for (const doc of docs) {
    docMap.set(doc.key, doc)
  }

  const adminRecords: WalletSettingAdminRecord[] = []
  for (const descriptor of WALLET_DESCRIPTORS) {
    const doc = docMap.get(descriptor.key)
    if (doc) {
      const decrypted = decryptValueIfNeeded(doc.value)
      adminRecords.push(
        computeAdminRecord(descriptor, decrypted, "db", doc.updatedAt ?? null, (doc as any).updatedBy ?? null),
      )
      continue
    }

    const fallback = readEnvFallback(descriptor.envKeys)
    if (fallback) {
      adminRecords.push(computeAdminRecord(descriptor, fallback, "env", null, null))
    } else {
      adminRecords.push(computeAdminRecord(descriptor, "", "unset", null, null))
    }
  }

  const snapshot: WalletSettingsSnapshot = {
    admin: adminRecords,
    public: computePublicRecords(adminRecords),
  }

  walletCache = { snapshot, expiresAt: now + CACHE_TTL_MS }
  return snapshot
}

export function invalidateWalletSettingsCache() {
  walletCache = null
}

export async function getWalletSettingsForAdmin(): Promise<WalletSettingAdminRecord[]> {
  const snapshot = await loadWalletSettingsSnapshot()
  return snapshot.admin
}

export async function getPublicWalletAddresses(): Promise<WalletSettingPublicRecord[]> {
  const snapshot = await loadWalletSettingsSnapshot()
  return snapshot.public
}

export function getWalletSettingsFromEnv(): WalletSettingAdminRecord[] {
  const adminRecords: WalletSettingAdminRecord[] = []

  for (const descriptor of WALLET_DESCRIPTORS) {
    const fallback = readEnvFallback(descriptor.envKeys)
    const source: "env" | "unset" = fallback ? "env" : "unset"
    adminRecords.push(computeAdminRecord(descriptor, fallback, source, null, null))
  }

  return adminRecords
}

function isValidEthereumLikeAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function isValidTronAddress(address: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
}

export class WalletSettingsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WalletSettingsValidationError"
  }
}

export class WalletSettingsRateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WalletSettingsRateLimitError"
  }
}

function validateWalletAddress(network: string, address: string): void {
  if (!address) {
    throw new WalletSettingsValidationError("Wallet address is required for all networks")
  }

  switch (network) {
    case "BEP20":
      if (!isValidEthereumLikeAddress(address)) {
        throw new WalletSettingsValidationError("BEP20 addresses must be 42-character 0x-prefixed hex strings")
      }
      break
    case "TRC20":
      if (!isValidTronAddress(address)) {
        throw new WalletSettingsValidationError("TRC20 addresses must be valid Tron base58 strings starting with 'T'")
      }
      break
    default:
      if (address.length < 10) {
        throw new WalletSettingsValidationError("Wallet address appears invalid")
      }
  }
}

async function enforceRateLimit(adminId: string) {
  const key = `${RATE_LIMIT_CACHE_PREFIX}${adminId}`
  const now = new Date()
  const existingDoc = await Cache.findOne({ key })
  const existing = existingDoc
    ? (typeof (existingDoc as any).toObject === "function" ? (existingDoc as any).toObject() : existingDoc)
    : null
  const expiresAt = existing?.expiresAt ? new Date(existing.expiresAt) : null

  if (existing && expiresAt && expiresAt > now) {
    const currentCount = Number(existing.value?.count ?? 0)
    if (currentCount >= RATE_LIMIT_MAX_CHANGES) {
      throw new WalletSettingsRateLimitError("Rate limit exceeded. Please wait before making more changes.")
    }

    await Cache.updateOne(
      { key },
      {
        $set: {
          key,
          value: { count: currentCount + 1 },
          expiresAt,
        },
      },
    )
    return
  }

  const newExpiresAt = new Date(Date.now() + RATE_LIMIT_WINDOW_MS)
  await Cache.updateOne(
    { key },
    {
      $set: {
        key,
        value: { count: 1 },
        expiresAt: newExpiresAt,
      },
    },
    { upsert: true },
  )
}

interface UpdateWalletSettingsInput {
  wallet1: string
  wallet2: string
  wallet3: string
  adminId: string
  ipAddress?: string | null
  reason?: string | null
}

export async function updateWalletAddressSettings(input: UpdateWalletSettingsInput): Promise<WalletSettingAdminRecord[]> {
  const payloadMap: Record<string, string> = {
    [WALLET_DESCRIPTORS[0].id]: normalizeAddress(input.wallet1),
    [WALLET_DESCRIPTORS[1].id]: normalizeAddress(input.wallet2),
    [WALLET_DESCRIPTORS[2].id]: normalizeAddress(input.wallet3),
  }

  const changes: Array<{
    descriptor: (typeof WALLET_DESCRIPTORS)[number]
    nextValue: string
    previousValue: string
    docId?: string
  }> = []

  await dbConnect()

  const docs = await AppSetting.find({
    key: { $in: WALLET_DESCRIPTORS.map((descriptor) => descriptor.key) },
  })
    .populate({ path: "updatedBy", select: { name: 1, email: 1 } })
    .lean()

  const docMap = new Map<string, (typeof docs)[number]>()
  for (const doc of docs) {
    docMap.set(doc.key, doc)
  }

  for (const descriptor of WALLET_DESCRIPTORS) {
    const nextValue = payloadMap[descriptor.id]
    validateWalletAddress(descriptor.network, nextValue)

    const existingDoc = docMap.get(descriptor.key)
    const previousValue = existingDoc
      ? decryptValueIfNeeded(existingDoc.value)
      : readEnvFallback(descriptor.envKeys)

    if (normalizeAddress(previousValue) === nextValue) {
      continue
    }

    changes.push({ descriptor, nextValue, previousValue: normalizeAddress(previousValue), docId: existingDoc?._id?.toString() })
  }

  if (changes.length === 0) {
    invalidateWalletSettingsCache()
    return getWalletSettingsForAdmin()
  }

  await enforceRateLimit(input.adminId)

  const sessionReason = typeof input.reason === "string" && input.reason.trim().length > 0 ? input.reason.trim().slice(0, 500) : null
  const ipAddress = input.ipAddress?.split(",")[0]?.trim() ?? null

  for (const change of changes) {
    const { payload, encrypted } = encryptString(change.nextValue)

    await AppSetting.updateOne(
      { key: change.descriptor.key },
      {
        $set: {
          key: change.descriptor.key,
          value: payload,
          encrypted,
          updatedBy: input.adminId,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    )

    const { payload: oldPayload } = encryptString(change.previousValue)

    await AppSettingAudit.create({
      key: change.descriptor.key,
      oldValue: oldPayload,
      newValue: payload,
      changedBy: input.adminId,
      changedAt: new Date(),
      ipAddress: ipAddress ?? undefined,
      reason: sessionReason ?? undefined,
    })
  }

  invalidateWalletSettingsCache()
  return getWalletSettingsForAdmin()
}

export async function findAuditEntries(
  filter: FilterQuery<IAppSettingAudit>,
): Promise<IAppSettingAudit[]> {
  await dbConnect()
  return AppSettingAudit.find(filter).sort({ changedAt: -1 }).exec()
}

export type { WalletSettingAdminRecord, WalletSettingPublicRecord }
