export interface MobileApkMetadata {
  version: string
  downloadUrl: string
  fileSizeMb?: number | null
  buildDate?: string | null
  releaseNotes?: string | null
}

export interface MobileAppConfig {
  apk: MobileApkMetadata | null
  pollIntervalMs: number
}

function parseNumber(value: string | undefined | null): number | null {
  if (!value) {
    return null
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function loadMobileAppConfig(): MobileAppConfig {
  const downloadUrl = process.env.MOBILE_APK_DOWNLOAD_URL
  const version = process.env.MOBILE_APK_VERSION ?? '0.0.0'
  const buildDate = process.env.MOBILE_APK_BUILD_DATE ?? null
  const fileSizeMb = parseNumber(process.env.MOBILE_APK_FILE_SIZE_MB)
  const releaseNotes = process.env.MOBILE_APK_RELEASE_NOTES ?? null
  const pollIntervalMs = Number.parseInt(process.env.MOBILE_APK_METADATA_POLL_MS ?? '300000', 10)

  if (!downloadUrl) {
    return {
      apk: null,
      pollIntervalMs
    }
  }

  return {
    apk: {
      version,
      downloadUrl,
      fileSizeMb,
      buildDate,
      releaseNotes
    },
    pollIntervalMs
  }
}
