import useSWR from "@/lib/swr"
import type { MobileApkMetadata } from "@/config/mobile-app"

interface MobileApkResponse {
  apk: MobileApkMetadata
  pollIntervalMs: number
}

async function fetchApkMetadata(key: string): Promise<MobileApkResponse> {
  const response = await fetch(key, { cache: "no-store" })
  if (!response.ok) {
    const message = await response.text().catch(() => "")
    throw new Error(message || "Failed to load APK metadata")
  }
  return response.json()
}

export function useMobileApkMetadata() {
  return useSWR<MobileApkResponse>("/api/mobile-app/apk", fetchApkMetadata, { revalidateOnFocus: true })
}
