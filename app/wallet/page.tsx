"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Wallet, ArrowUpRight, ArrowDownLeft, Copy, CheckCircle } from "lucide-react"
import { DepositForm } from "@/components/wallet/deposit-form"

interface Balance {
  current: number
  totalBalance: number
  totalEarning: number
  lockedCapital: number
  staked: number
  pendingWithdraw: number
}

export default function WalletPage() {
  const [user, setUser] = useState<any>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  // Withdraw form state
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    walletAddress: "",
  })
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")
  const [withdrawSuccess, setWithdrawSuccess] = useState("")

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [userRes, dashboardRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/dashboard")])

      if (userRes.ok && dashboardRes.ok) {
        const userData = await userRes.json()
        const dashboardData = await dashboardRes.json()
        setUser(userData.user)
        setBalance({
          current: dashboardData.kpis.currentBalance,
          totalBalance: dashboardData.kpis.totalBalance,
          totalEarning: dashboardData.kpis.totalEarning,
          lockedCapital: 0, // Would need to calculate from deposits
          staked: 0, // Would come from staking system
          pendingWithdraw: dashboardData.kpis.pendingWithdraw,
        })
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setWithdrawLoading(true)
    setWithdrawError("")
    setWithdrawSuccess("")

    try {
      const response = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number.parseFloat(withdrawForm.amount),
          walletAddress: withdrawForm.walletAddress,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setWithdrawSuccess("Withdrawal request submitted successfully! Awaiting admin approval.")
        setWithdrawForm({ amount: "", walletAddress: "" })
        fetchData()
      } else {
        setWithdrawError(data.error || "Withdrawal failed")
      }
    } catch (err) {
      setWithdrawError("Network error. Please try again.")
    } finally {
      setWithdrawLoading(false)
    }
  }

  const copyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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

      <main className="flex-1 md:ml-64 overflow-auto">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-balance">D-Wallet</h1>
            <p className="text-muted-foreground">Manage your platform balance and transactions</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Balance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${balance?.current.toFixed(2) || "0.00"}</div>
                    <p className="text-xs text-muted-foreground">Available for withdrawal</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${balance?.totalBalance.toFixed(2) || "0.00"}</div>
                    <p className="text-xs text-muted-foreground">Lifetime balance</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      ${balance?.totalEarning.toFixed(2) || "0.00"}
                    </div>
                    <p className="text-xs text-muted-foreground">From mining & commissions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Withdraw</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      ${balance?.pendingWithdraw.toFixed(2) || "0.00"}
                    </div>
                    <p className="text-xs text-muted-foreground">Awaiting approval</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Staked Amount</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">${balance?.staked.toFixed(2) || "0.00"}</div>
                    <p className="text-xs text-muted-foreground">Currently staking</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Referral Code</CardTitle>
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2">
                      <code className="text-lg font-bold font-mono text-amber-600">{user?.referralCode}</code>
                      <Button variant="ghost" size="sm" onClick={copyReferralCode} className="h-8 w-8 p-0">
                        {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Share to earn commissions</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="deposit" className="space-y-6">
              <Card className="border-0 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownLeft className="h-5 w-5" />
                    Make a Deposit
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Deposit at least $30 USDT to unlock mining. Submit the blockchain hash and full exchange
                    screenshot—our compliance team verifies every request before crediting.
                  </p>
                </CardHeader>
                <CardContent>
                  <DepositForm onSuccess={fetchData} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdraw" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUpRight className="h-5 w-5" />
                    Request Withdrawal
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Minimum withdrawal: $30 USDT. Withdrawals require admin approval.
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleWithdraw} className="space-y-4">
                    {withdrawError && (
                      <Alert variant="destructive">
                        <AlertDescription>{withdrawError}</AlertDescription>
                      </Alert>
                    )}

                    {withdrawSuccess && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">{withdrawSuccess}</AlertDescription>
                      </Alert>
                    )}

                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm">
                        <strong>Available Balance:</strong> ${balance?.current.toFixed(2) || "0.00"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="withdraw-amount">Amount (USDT)</Label>
                      <Input
                        id="withdraw-amount"
                        type="number"
                        min="30"
                        max={balance?.current || 0}
                        step="0.01"
                        placeholder="Enter amount (min $30)"
                        value={withdrawForm.amount}
                        onChange={(e) => setWithdrawForm((prev) => ({ ...prev, amount: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="withdraw-wallet">Destination Wallet Address</Label>
                      <Input
                        id="withdraw-wallet"
                        type="text"
                        placeholder="Enter destination wallet address"
                        value={withdrawForm.walletAddress}
                        onChange={(e) => setWithdrawForm((prev) => ({ ...prev, walletAddress: e.target.value }))}
                        required
                      />
                    </div>

                    <Button type="submit" disabled={withdrawLoading || !balance?.current} className="w-full">
                      {withdrawLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="mr-2 h-4 w-4" />
                          Request Withdrawal
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
