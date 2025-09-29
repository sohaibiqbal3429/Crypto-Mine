import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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

  // Admin-only routes
  if (pathname.startsWith("/admin") && user?.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
}
