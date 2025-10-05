const DIGIT_ONLY_REGEX = /\D/g
const LEADING_ZERO_REGEX = /^0+/
const E164_REGEX = /^\+[1-9]\d{7,14}$/

interface PhoneSearchResult {
  canonical: string | null
  queries: Array<{ phone: string }>
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (!value || value === "+") continue
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }

  return result
}

export function buildPhoneSearch(rawInput: string | null | undefined): PhoneSearchResult | null {
  if (!rawInput) return null

  const trimmed = rawInput.trim()
  if (!trimmed) return null

  const digitsOnly = trimmed.replace(DIGIT_ONLY_REGEX, "")
  if (!digitsOnly) return null

  const withoutLeadingZeros = digitsOnly.replace(LEADING_ZERO_REGEX, "") || digitsOnly
  const plusPrefixed = trimmed.startsWith("+") ? `+${digitsOnly}` : `+${withoutLeadingZeros}`
  const canonical = E164_REGEX.test(plusPrefixed) ? plusPrefixed : null

  const candidates = uniqueValues([
    trimmed,
    digitsOnly,
    withoutLeadingZeros,
    plusPrefixed,
    `+${digitsOnly}`,
    canonical ?? "",
    withoutLeadingZeros ? `0${withoutLeadingZeros}` : "",
  ])

  if (!candidates.length) {
    return canonical ? { canonical, queries: [{ phone: canonical }] } : null
  }

  const queries = candidates.map((value) => ({ phone: value }))

  return {
    canonical,
    queries,
  }
}

export function isValidE164(value: string): boolean {
  return E164_REGEX.test(value)
}

export function normalisePhone(value: string): string | null {
  const search = buildPhoneSearch(value)
  return search?.canonical ?? null
}
