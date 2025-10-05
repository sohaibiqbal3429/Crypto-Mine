import { NextResponse } from "next/server"

import { getLaunchSchedule } from "@/lib/services/launch"

export async function GET() {
  const { launchAt } = getLaunchSchedule()
  const serverNow = new Date()

  return NextResponse.json(
    {
      launch_at: launchAt.toISOString(),
      server_now: serverNow.toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  )
}
