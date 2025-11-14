import assert from "node:assert/strict"
import test from "node:test"

import { GET } from "@/app/api/mobile-app/apk/route"

const originalEnv = { ...process.env }

test.after(() => {
  process.env = { ...originalEnv }
})

test("GET /api/mobile-app/apk returns metadata when configured", async () => {
  process.env = { ...originalEnv }
  process.env.MOBILE_APK_DOWNLOAD_URL = "https://cdn.example.com/app.apk"
  process.env.MOBILE_APK_VERSION = "1.2.3"
  process.env.MOBILE_APK_FILE_SIZE_MB = "55.5"
  process.env.MOBILE_APK_BUILD_DATE = "2024-11-29T00:00:00Z"
  process.env.MOBILE_APK_RELEASE_NOTES = "Stability improvements"
  process.env.MOBILE_APK_METADATA_POLL_MS = "60000"

  const response = await GET()
  assert.equal(response.status, 200)

  const payload = (await response.json()) as any
  assert.equal(payload.apk.version, "1.2.3")
  assert.equal(payload.apk.downloadUrl, "https://cdn.example.com/app.apk")
  assert.equal(payload.apk.fileSizeMb, 55.5)
  assert.equal(payload.pollIntervalMs, 60000)
})

test("GET /api/mobile-app/apk returns 503 when missing URL", async () => {
  process.env = { ...originalEnv }
  delete process.env.MOBILE_APK_DOWNLOAD_URL

  const response = await GET()
  assert.equal(response.status, 503)
})
