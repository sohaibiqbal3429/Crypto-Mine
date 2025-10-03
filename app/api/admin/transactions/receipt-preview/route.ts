import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(userPayload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const urlParam = searchParams.get("url")

    if (!urlParam) {
      return NextResponse.json({ error: "Missing receipt URL" }, { status: 400 })
    }

    let targetUrl: URL
    try {
      targetUrl = /^https?:/i.test(urlParam)
        ? new URL(urlParam)
        : new URL(urlParam, request.nextUrl.origin)
    } catch (error) {
      return NextResponse.json({ error: "Invalid receipt URL" }, { status: 400 })
    }

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return NextResponse.json({ error: "Unsupported receipt protocol" }, { status: 400 })
    }

    const forwardedHeaders = new Headers()
    if (targetUrl.origin === request.nextUrl.origin) {
      const cookie = request.headers.get("cookie")
      if (cookie) {
        forwardedHeaders.set("cookie", cookie)
      }
    }

    const response = await fetch(targetUrl.toString(), {
      cache: "no-store",
      headers: forwardedHeaders,
      redirect: "follow",
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Unable to load receipt" }, { status: response.status })
    }

    const arrayBuffer = await response.arrayBuffer()
    const headers = new Headers()
    const contentType = response.headers.get("content-type") || "application/octet-stream"
    const contentLength = response.headers.get("content-length") || String(arrayBuffer.byteLength)

    headers.set("Content-Type", contentType)
    headers.set("Content-Length", contentLength)
    headers.set("Cache-Control", "no-store")

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Receipt preview error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
