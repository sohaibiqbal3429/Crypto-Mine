import { NextResponse } from "next/server"

import { loadMobileAppConfig } from "@/config/mobile-app"

export async function GET() {
  const config = loadMobileAppConfig()

  if (!config.apk) {
    return NextResponse.json({ error: "APK metadata not configured" }, { status: 503 })
  }

  return NextResponse.json({ apk: config.apk, pollIntervalMs: config.pollIntervalMs })
}
