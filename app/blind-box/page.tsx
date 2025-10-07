import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { BlindBoxDashboard } from "@/components/blindbox/blind-box-dashboard"
import { Sidebar } from "@/components/layout/sidebar"
import { getBlindBoxSummaryForUser, listBlindBoxRounds } from "@/lib/services/blindbox"
import { fetchWalletContext } from "@/lib/services/wallet"
import { verifyToken } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function BlindBoxPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) {
    redirect("/auth/login")
  }

  const session = await verifyToken(token)
  if (!session) {
    redirect("/auth/login")
  }

  const [walletContext, summary, history] = await Promise.all([
    fetchWalletContext(session.userId),
    getBlindBoxSummaryForUser(session.userId),
    listBlindBoxRounds(10),
  ])

  if (!walletContext) {
    redirect("/auth/login")
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar user={walletContext.user} />
      <main className="relative flex-1 overflow-y-auto md:ml-64">
        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
          <BlindBoxDashboard initialSummary={summary} initialHistory={history} />
        </div>
      </main>
    </div>
  )
}
