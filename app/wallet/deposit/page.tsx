"use client"

import { useEffect, useState } from "react"

import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowDownLeft } from "lucide-react"
import { DepositForm } from "@/components/wallet/deposit-form"

export default function WalletDepositPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/me")
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
      } catch (error) {
        console.error("Failed to load user information", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto md:ml-64">
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Deposit Funds</h1>
            <p className="text-muted-foreground">
              Transfer USDT to the platform wallet address and submit your transaction hash for verification.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5" />
                Deposit Instructions
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                The deposit address below is unique to the platform. All users share the same address for now.
              </p>
            </CardHeader>
            <CardContent>
              <DepositForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

