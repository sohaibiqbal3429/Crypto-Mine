import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifyToken } from "@/lib/auth"
import { getAdminInitialData } from "@/lib/services/admin"
import { getWalletSettingsFromEnv } from "@/lib/services/app-settings"
import { getDailyProfitPercentBounds } from "@/lib/services/settings"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value

  if (!token) {
    redirect("/auth/login")
  }

  const session = verifyToken(token)
  if (!session) {
    redirect("/auth/login")
  }

  if (session.role !== "admin") {
    redirect("/dashboard")
  }

  let initialError: string | null = null

  const fallbackUser = {
    name: "Admin",
    email: session.email,
    referralCode: "",
    role: session.role,
  }

  const fallbackStats = {
    totalUsers: 0,
    activeUsers: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingLuckyDrawDeposits: 0,
  }

  const fallbackWallets = getWalletSettingsFromEnv()

  const fallbackSettings = {
    dailyProfitPercent: 1.5,
    bounds: getDailyProfitPercentBounds(),
    wallets: fallbackWallets,
  }

  try {
    const { adminUser, stats, settings } = await getAdminInitialData(session.userId)
    return <AdminDashboard initialUser={adminUser} initialStats={stats} initialSettings={settings} />
  } catch (error) {
    console.error("Failed to load admin panel:", error)

    if (error instanceof Error && error.message === "Admin access required") {
      redirect("/dashboard")
    }

    initialError = "Unable to load admin data automatically. Use the refresh button to try again."
  }

  return (
    <AdminDashboard
      initialUser={fallbackUser}
      initialStats={fallbackStats}
      initialSettings={fallbackSettings}
      initialError={initialError}
    />
  )
}
