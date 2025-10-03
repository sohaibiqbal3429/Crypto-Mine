import type { FilterQuery } from "mongoose"

type ContactFilters = Array<Record<string, string>>

type ContactQuery<T> = FilterQuery<T>

export interface NormalizedContact {
  email?: string
  phone?: string
}

export function normalizeContact(email?: string | null, phone?: string | null): NormalizedContact {
  const normalizedEmail = email?.trim().toLowerCase()
  const normalizedPhone = phone?.trim()

  const contact: NormalizedContact = {}

  if (normalizedEmail) {
    contact.email = normalizedEmail
  }

  if (normalizedPhone) {
    contact.phone = normalizedPhone
  }

  return contact
}

export function buildContactFilters({ email, phone }: NormalizedContact): ContactFilters {
  const filters: ContactFilters = []

  if (email) {
    filters.push({ email })
  }

  if (phone) {
    filters.push({ phone })
  }

  return filters
}

export function mergeContactFilters<T>(filters: ContactFilters): ContactQuery<T> | null {
  if (filters.length === 0) {
    return null
  }

  if (filters.length === 1) {
    return filters[0] as ContactQuery<T>
  }

  return { $or: filters } as ContactQuery<T>
}

export function buildContactQuery<T>(contact: NormalizedContact): ContactQuery<T> | null {
  const filters = buildContactFilters(contact)
  return mergeContactFilters<T>(filters)
}
