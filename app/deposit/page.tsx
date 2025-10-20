import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DepositForm } from "@/components/wallet/deposit-form"
import { verifyToken } from "@/lib/auth"
import { getDepositWalletOptions } from "@/lib/config/wallet"
import { fetchWalletContext } from "@/lib/services/wallet"
import { Wallet } from "lucide-react"

export const dynamic = "force-dynamic"

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

  const walletOptions = getDepositWalletOptions()

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
          </header>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${context.stats.walletBalance.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Total funds recorded for your account.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm font-medium">Minimum Deposit</CardTitle>
                <CardDescription>Transactions below this amount will be rejected automatically.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">${context.minDeposit.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
                <CardDescription>Funds currently awaiting approval.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  ${context.stats.pendingWithdraw.toFixed(2)}
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
                  <DepositForm options={walletOptions} minDeposit={context.minDeposit} />
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  )
}
