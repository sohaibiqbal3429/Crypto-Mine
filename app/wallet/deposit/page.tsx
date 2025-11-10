import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { verifyToken } from "@/lib/auth"
import { fetchWalletContext } from "@/lib/services/wallet"
import { getDepositWalletOptions } from "@/lib/config/wallet"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowDownLeft } from "lucide-react"
import { DepositForm } from "@/components/wallet/deposit-form"

export default async function WalletDepositPage() {
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

  const walletOptions = await getDepositWalletOptions()

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={context.user} />

      <main className="flex-1 overflow-auto md:ml-64">
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Deposit Funds</h1>
            <p className="text-muted-foreground">
              Transfer USDT to one of the approved wallet addresses below and submit your transaction hash for verification.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5" />
                Deposit Instructions
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose the network that matches your exchange withdrawal. Only confirmed deposits will be credited to your account.
              </p>
            </CardHeader>
            <CardContent>
              {walletOptions.length === 0 ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Deposit wallets are not configured. Please contact support.
                  </AlertDescription>
                </Alert>
              ) : (
                <DepositForm options={walletOptions} minDeposit={context.minDeposit} />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
