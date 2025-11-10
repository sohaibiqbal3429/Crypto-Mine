import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { DepositForm } from "@/components/wallet/deposit-form"
import { verifyToken } from "@/lib/auth"
import { getDepositWalletOptions } from "@/lib/config/wallet"
import { fetchWalletContext } from "@/lib/services/wallet"
import {
  ACTIVE_DEPOSIT_THRESHOLD,
  DEPOSIT_L1_PERCENT,
  DEPOSIT_L2_PERCENT_ACTIVE,
  DEPOSIT_SELF_PERCENT_ACTIVE,
} from "@/lib/constants/bonuses"
import { Wallet } from "lucide-react"

export const dynamic = "force-dynamic"

const pct = (n: number) => `${(n * 100).toFixed(0)}%`
const num = (v: unknown, fallback = 0) => {
  if (v === null || v === undefined) return fallback
  if (typeof v === "number") return v
  const n = Number((v as any).toString?.() ?? v)
  return Number.isFinite(n) ? n : fallback
}

export default async function DepositPage() {
  const token = cookies().get("auth-token")?.value
  if (!token) {
    redirect("/auth/login")
  }

  const session = verifyToken(token)
  if (!session) {
    redirect("/auth/login")
  }

  const context = await fetchWalletContext(session.userId)
  if (!context) {
    redirect("/auth/login")
  }

  const walletOptions = await getDepositWalletOptions()

  const isActive = !!context.user.isActive
  const lifetimeDeposits = num(context.user.depositTotal)
  const threshold = num(ACTIVE_DEPOSIT_THRESHOLD, 80)
  const remainingToActivate = Math.max(0, threshold - lifetimeDeposits)

  const walletBalance = num(context.stats?.walletBalance)
  const pendingWithdraw = num(context.stats?.pendingWithdraw)
  const minDeposit = num(context.minDeposit)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={context.user} />
      <main className="flex-1 overflow-y-auto md:ml-64">
        <div className="space-y-6 p-6">
          <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Deposit Funds</h1>
              <p className="text-muted-foreground">
                Transfer USDT to the platform wallets and track your credited balance.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 text-sm md:items-end">
              <Badge variant={isActive ? "default" : "outline"} className="uppercase tracking-wide">
                {isActive ? "Active" : "Inactive"}
              </Badge>
              <span className="text-muted-foreground">
                Lifetime deposits: ${lifetimeDeposits.toFixed(2)} / ${threshold.toFixed(2)}
              </span>
              {!isActive ? (
                <span className="text-xs text-muted-foreground">
                  Deposit ${remainingToActivate.toFixed(2)} more to unlock deposit bonuses.
                </span>
              ) : null}
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${walletBalance.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Total funds recorded for your account.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm font-medium">Minimum Deposit</CardTitle>
                <CardDescription>Transactions below this amount will be rejected automatically.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">${minDeposit.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
                <CardDescription>Funds currently awaiting approval.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">${pendingWithdraw.toFixed(2)}</div>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card>
              <CardHeader>
                <CardTitle>Bonus &amp; Referral Breakdown</CardTitle>
                <CardDescription>
                  Percentages are of the <strong>deposit amount</strong>. Your status is recalculated{" "}
                  <strong>after each deposit</strong>; bonuses for that deposit use your{" "}
                  <strong>post-update</strong> status.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Your bonus</p>
                  <p className="text-xl font-semibold text-primary">
                    {isActive ? `${pct(DEPOSIT_SELF_PERCENT_ACTIVE)} of every deposit` : `Become Active to unlock ${pct(DEPOSIT_SELF_PERCENT_ACTIVE)}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">L1 referral share</p>
                  <p className="text-xl font-semibold">
                    {pct(DEPOSIT_L1_PERCENT)} of each deposit (always, if you have an L1)
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">L2 referral share</p>
                  <p className="text-xl font-semibold">
                    {isActive
                      ? `${pct(DEPOSIT_L2_PERCENT_ACTIVE)} when you are Active`
                      : "0% until you are Active"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card>
              <CardHeader>
                <CardTitle>Submit a Deposit</CardTitle>
                <CardDescription>
                  Choose a supported wallet, transfer your funds, and upload the confirmation receipt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {walletOptions.length === 0 ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Deposit wallets are not configured. Please contact support for assistance.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <DepositForm options={walletOptions} minDeposit={minDeposit} />
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  )
}
