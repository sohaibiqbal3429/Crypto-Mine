const DEFAULT_API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://mintminepro.com/api"
    : "http://localhost:3000/api"

/**
 * Resolve the canonical backend base URL for both web and mobile clients.
 * In production this should point at the same deployed API host that powers the web app.
 */
export function resolveApiBaseUrl(): string {
  const raw =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api` : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api` : null) ||
    DEFAULT_API_BASE

  return raw.replace(/\/$/, "")
}

export function withApiBase(path: string): string {
  const base = resolveApiBaseUrl()
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}
