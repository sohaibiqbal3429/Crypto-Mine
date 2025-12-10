import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getTokenFromRequest, getUserFromRequest } from "@/lib/auth-middleware"
import { enforceUnifiedRateLimit, getRateLimitContext, shouldBypassRateLimit } from "@/lib/rate-limit/edge"
import { trackRequestRate } from "@/lib/observability/request-metrics"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const context = getRateLimitContext(request)

  trackRequestRate("reverse-proxy", { path: pathname })

  if (!shouldBypassRateLimit(pathname, context)) {
    const decision = await enforceUnifiedRateLimit("reverse-proxy", context, { path: pathname })
    if (!decision.allowed && decision.response) {
      return decision.response
    }
  }

  if (pathname.startsWith("/api/auth/status")) {
    return NextResponse.next()
  }

  // Public routes that don't require authentication
  const publicRoutes = ["/auth/login", "/auth/register", "/", "/support"]
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  // API routes that don't require authentication
  const publicApiRoutes = ["/api/auth/login", "/api/auth/register"]
  const isPublicApiRoute = publicApiRoutes.some((route) => pathname.startsWith(route))

  // Get user from request
  const user = await getUserFromRequest(request)

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
