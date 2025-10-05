import User, { type IUser } from "@/models/User"
import type { ISettings } from "@/models/Settings"

const DEFAULT_QUALIFYING_DEPOSIT = 80

export function resolveActivationThreshold(settings?: ISettings | null): number {
  const configured = settings?.gating?.activeMinDeposit
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) {
    return Math.max(configured, DEFAULT_QUALIFYING_DEPOSIT)
  }
  return DEFAULT_QUALIFYING_DEPOSIT
}

export function evaluateSponsorLink(meta: unknown): boolean | undefined {
  if (!meta || typeof meta !== "object") {
    return undefined
  }

  const candidate = meta as Record<string, unknown>

  if (candidate.isFakeDeposit === true) {
    return false
  }

  const booleanKeys = ["viaSponsorLink", "sponsorLink", "sponsor_link", "sponsored"]
  for (const key of booleanKeys) {
    const value = candidate[key]
    if (typeof value === "boolean") {
      return value
    }
  }

  const stringKeys = ["source", "channel", "origin", "referralSource"]
  for (const key of stringKeys) {
    const value = candidate[key]
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (!normalized) continue
      if (normalized.includes("sponsor")) {
        return true
      }
      if (normalized.includes("admin") || normalized.includes("manual")) {
        return false
      }
    }
  }

  return undefined
}

export function inferSponsorLink(meta: unknown, user?: Pick<IUser, "referredBy"> | null): boolean {
  const evaluated = evaluateSponsorLink(meta)
  if (typeof evaluated === "boolean") {
    return evaluated
  }
  return Boolean(user?.referredBy)
}

export function isUserActiveByPolicy(
  user: Pick<IUser, "isActive"> & {
    first_qualifying_deposit_at?: Date | null
    firstQualifyingDepositAt?: Date | null
  },
): boolean {
  if (!user) return false
  if (user.isActive) return true

  const recorded = (user as Record<string, unknown>).firstQualifyingDepositAt as Date | null | undefined
  if (recorded instanceof Date) {
    return true
  }

  const snakeCase = user.first_qualifying_deposit_at
  if (snakeCase instanceof Date) {
    return true
  }

  return false
}

interface EnsureActivationOptions {
  userId: string
  userDoc?: (IUser & { first_qualifying_deposit_at?: Date | null; first_qualifying_deposit_amount?: number | null }) | null
  depositAmount: number
  meta?: unknown
  occurredAt?: Date
  settings?: ISettings | null
  sponsorLinkOverride?: boolean
}

export async function ensureUserActivationForDeposit(options: EnsureActivationOptions): Promise<{
  activated: boolean
  updated: boolean
  threshold: number
}> {
  const { userId, depositAmount, meta, occurredAt = new Date(), settings, sponsorLinkOverride } = options

  const threshold = resolveActivationThreshold(settings)
  if (!(depositAmount >= threshold)) {
    return { activated: false, updated: false, threshold }
  }

  const user =
    options.userDoc ??
    (await User.findById(userId).select(
      "isActive referredBy first_qualifying_deposit_at first_qualifying_deposit_amount",
    ))
  if (!user) {
    return { activated: false, updated: false, threshold }
  }

  const sponsorLinkUsed =
    typeof sponsorLinkOverride === "boolean" ? sponsorLinkOverride : inferSponsorLink(meta, user as IUser)
  if (!sponsorLinkUsed) {
    return { activated: false, updated: false, threshold }
  }

  const updates: Record<string, unknown> = {}

  if (!user.first_qualifying_deposit_at) {
    updates.first_qualifying_deposit_at = occurredAt
  }

  if (
    user.first_qualifying_deposit_amount === undefined ||
    user.first_qualifying_deposit_amount === null ||
    user.first_qualifying_deposit_amount <= 0
  ) {
    updates.first_qualifying_deposit_amount = depositAmount
  }

  let activated = false
  if (!user.isActive) {
    updates.isActive = true
    activated = true
  }

  if (Object.keys(updates).length === 0) {
    return { activated: false, updated: false, threshold }
  }

  await User.updateOne({ _id: user._id }, { $set: updates })

  return { activated, updated: true, threshold }
}

export { DEFAULT_QUALIFYING_DEPOSIT }
