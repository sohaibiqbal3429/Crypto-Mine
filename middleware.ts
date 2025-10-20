import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getTokenFromRequest, getUserFromRequest } from "@/lib/auth"

const WINDOW = 60_000
const LIMIT = 200
const hits = new Map<string, number[]>()

export async function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.ip || "local"
  const now = Date.now()
  const recentHits = (hits.get(ip) || []).filter((timestamp) => now - timestamp < WINDOW)
  recentHits.push(now)
  hits.set(ip, recentHits)

  if (recentHits.length > LIMIT) {
    return new NextResponse("Too many requests", { status: 429 })
  }

  const { pathname } = request.nextUrl

  if (pathname.startsWith("/api/auth/status")) {
    return NextResponse.next()
  }

  // Public routes that don't require authentication
  const publicRoutes = ["/auth/login", "/auth/register", "/"]
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  // API routes that don't require authentication
  const publicApiRoutes = ["/api/auth/login", "/api/auth/register"]
  const isPublicApiRoute = publicApiRoutes.some((route) => pathname.startsWith(route))

  // Get user from request
  const user = getUserFromRequest(request)

  // Redirect authenticated users away from auth pages
  if (user && (pathname.startsWith("/auth/") || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute && !isPublicApiRoute) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }

  if (user) {
    try {
      const token = getTokenFromRequest(request)
      if (token) {
        const statusResponse = await fetch(new URL("/api/auth/status", request.url), {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })

        if (statusResponse.ok) {
          const payload = await statusResponse.json()
          if (payload?.blocked) {
            const guardedPages = [
              "/dashboard",
              "/deposit",
              "/withdraw",
              "/transactions",
              "/mining",
            ]
            const guardedApis = [
              "/api/wallet",
              "/api/deposit",
              "/api/withdraw",
              "/api/mining",
              "/api/dashboard",
            ]

            const isBlockedPage = guardedPages.some((prefix) => pathname.startsWith(prefix))
            const isBlockedApi = guardedApis.some((prefix) => pathname.startsWith(prefix))

            if (isBlockedPage || isBlockedApi) {
              if (pathname.startsWith("/api/")) {
                return NextResponse.json({ error: "Account blocked", blocked: true }, { status: 403 })
              }

              const url = new URL("/auth/login", request.url)
              url.searchParams.set("blocked", "1")
              return NextResponse.redirect(url)
            }
          }
        }
      }
    } catch (error) {
      console.error("Middleware block guard failed", error)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
}
