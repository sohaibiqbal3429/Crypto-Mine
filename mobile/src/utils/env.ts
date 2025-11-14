import { Platform } from 'react-native'
import Config from 'react-native-config'

type Numberish = string | number | undefined | null

function parseNumber(value: Numberish, fallback: number): number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

const rawBaseUrl = Config.API_BASE_URL ?? (globalThis as any)?.API_BASE_URL ?? process.env.API_BASE_URL

export const API_BASE_URL =
  (typeof rawBaseUrl === 'string' && rawBaseUrl.length > 0 ? rawBaseUrl : undefined) ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000')

export const REALTIME_REFETCH_INTERVAL_MS = parseNumber(
  Config.REALTIME_REFETCH_INTERVAL_MS ?? (globalThis as any)?.REALTIME_REFETCH_INTERVAL_MS ?? process.env.REALTIME_REFETCH_INTERVAL_MS,
  15000
)
