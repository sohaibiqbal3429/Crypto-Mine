import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { GiftBoxDashboard } from "@/components/giftbox/gift-box-dashboard"
import { GiftBoxErrorState } from "@/components/giftbox/gift-box-error-state"
import { Sidebar } from "@/components/layout/sidebar"
import { logError, logWarn } from "@/lib/logger"
import { getGiftBoxSummaryForUser, listGiftBoxCycles } from "@/lib/services/giftbox"
import { fetchWalletContext } from "@/lib/services/wallet"
import { verifyToken } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function GiftBoxPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) {
    redirect("/auth/login")
  }

  const session = await verifyToken(token)
  if (!session) {
    redirect("/auth/login")
  }

  let walletContext: Awaited<ReturnType<typeof fetchWalletContext>> | null = null
  let summary: Awaited<ReturnType<typeof getGiftBoxSummaryForUser>> | null = null
  let cycles: Awaited<ReturnType<typeof listGiftBoxCycles>> | [] = []

  try {
    ;[walletContext, summary, cycles] = await Promise.all([
      fetchWalletContext(session.userId),
      getGiftBoxSummaryForUser(session.userId),
      listGiftBoxCycles(10),
    ])
  } catch (error) {
    logError("app/gift-box/page", "Failed to load gift box data", {
      error,
      userId: session.userId,
    })

    return (
      <div className="flex min-h-screen bg-slate-950 text-white">
        <main className="relative flex-1 overflow-y-auto">
          <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
            <GiftBoxErrorState
              message="We couldn't reach the Gift Box services right now. Check your database connection or enable the in-memory demo store by setting SEED_IN_MEMORY=true."
              details="Server administrators can review the application logs for a full stack trace."
            />
          </div>
        </main>
      </div>
    )
  }

  if (!walletContext) {
    logWarn("app/gift-box/page", "Wallet context was not found for authenticated user", {
      userId: session.userId,
    })

    return (
      <div className="flex min-h-screen bg-slate-950 text-white">
        <main className="relative flex-1 overflow-y-auto">
          <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
            <GiftBoxErrorState
              message="Your profile data is missing, so the Gift Box dashboard cannot be displayed."
              details="Ask an administrator to ensure your account exists and has an associated wallet record."
            />
          </div>
        </main>
      </div>
    )
  }

  if (!summary) {
    logWarn("app/gift-box/page", "Gift box summary service returned no data", {
      userId: session.userId,
    })

    return (
      <div className="flex min-h-screen bg-slate-950 text-white">
        <main className="relative flex-1 overflow-y-auto">
          <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
            <GiftBoxErrorState
              message="The giveaway summary is unavailable right now."
              details="Try again later or ask an administrator to verify the Gift Box configuration."
            />
          </div>
        </main>
      </div>
    )
  }

  const history = Array.isArray(cycles)
    ? cycles
    : Array.isArray((cycles as any)?.cycles)
      ? ((cycles as any).cycles as typeof cycles)
      : []

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar user={walletContext.user} />
      <main className="relative flex-1 overflow-y-auto md:ml-64">
        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
          <GiftBoxDashboard initialSummary={summary} initialHistory={history} />
        </div>
      </main>
    </div>
  )
}
