import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { verifyToken } from "@/lib/auth"
import { fetchWalletContext } from "@/lib/services/wallet"
import { getDepositWalletOptions } from "@/lib/config/wallet"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DepositForm } from "@/components/wallet/deposit-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react"

export default async function WalletPage() {
  const token = cookies().get("auth-token")?.value
  if (!token) {
    redirect("/auth/login")
  }

  const session = verifyToken(token!)
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

      <main className="flex-1 md:ml-64 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-balance">D-Wallet</h1>
              <p className="text-muted-foreground">Manage your platform balance and transactions</p>
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${context.stats.currentBalance.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Available for withdrawal</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${context.stats.totalBalance.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Lifetime balance</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${context.stats.totalEarning.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">From mining & commissions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Withdraw</CardTitle>
                <ArrowDownLeft className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">${context.stats.pendingWithdraw.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>
          </section>

          {walletOptions.length === 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                Deposit wallets are not configured. Please contact support.
              </AlertDescription>
            </Alert>
          ) : (
            <DepositForm options={walletOptions} minDeposit={context.minDeposit} />
          )}
        </div>
      </main>
    </div>
  )
}
