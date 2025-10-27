const FALLBACK_EFFECTIVE_AT = "1970-01-01T00:00:00.000Z"

let cachedEffectiveAt: Date | null = null

function parseEffectiveAt(): Date {
  if (cachedEffectiveAt) {
    return cachedEffectiveAt
  }

  const raw =
    process.env.POLICY_EFFECTIVE_AT ?? process.env.NEW_POLICY_EFFECTIVE_AT ?? FALLBACK_EFFECTIVE_AT

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    cachedEffectiveAt = new Date(FALLBACK_EFFECTIVE_AT)
    return cachedEffectiveAt
  }

  cachedEffectiveAt = parsed
  return cachedEffectiveAt
}

export function getPolicyEffectiveAt(): Date {
  return parseEffectiveAt()
}

export function isPolicyEffectiveFor(date: Date): boolean {
  return date.getTime() >= parseEffectiveAt().getTime()
}

