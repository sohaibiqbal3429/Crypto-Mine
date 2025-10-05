"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function TermsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch("/api/auth/me")
        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData.user)
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
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
        <div className="p-6 lg:p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-balance">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: January 15, 2025</p>
          </div>

          <div className="space-y-6 lg:space-y-8">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>1. Acceptance of Terms</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  By accessing and using Mintmine Pro ("the Platform"), you accept and agree to be bound by the terms
                  and provision of this agreement. If you do not agree to abide by the above, please do not use this
                  service.
                </p>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle>2. Platform Description</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>Mintmine Pro is a cryptocurrency mining and investment platform that allows users to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Participate in P-Coin mining activities</li>
                  <li>Stake cryptocurrencies for rewards</li>
                  <li>Refer new users and earn commissions</li>
                  <li>Manage digital wallets and transactions</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle>3. User Responsibilities</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>Users are responsible for:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Providing accurate and truthful information during registration</li>
                  <li>Maintaining the security of their account credentials</li>
                  <li>Complying with all applicable laws and regulations</li>
                  <li>Not engaging in fraudulent or malicious activities</li>
                  <li>Understanding the risks associated with cryptocurrency investments</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle>4. Mining and Rewards</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  Mining rewards are calculated based on various factors including user level, deposit amount, and
                  platform performance. Rewards are not guaranteed and may vary based on market conditions and platform
                  policies.
                </p>
                <p>
                  Users can mine P-Coins once every 24 hours. The platform reserves the right to adjust mining rewards
                  and cooldown periods as needed.
                </p>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle>5. Deposits and Withdrawals</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  Minimum deposit: $80 USDT
                  <br />
                  Minimum withdrawal: $10 USDT
                  <br />
                  Withdrawal processing time: 24-48 hours
                  <br />
                  Withdrawal fee: 2% of the withdrawal amount
                </p>
                <p>
                  All transactions are subject to verification and may be delayed or rejected if they violate platform
                  policies or applicable laws.
                </p>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle>6. Referral Program</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  Users can earn commissions by referring new users to the platform. Commission rates vary by level and
                  are subject to change. Referral abuse or fraudulent referrals may result in account suspension.
                </p>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle>7. Risk Disclosure</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p className="font-semibold text-amber-600">
                  IMPORTANT: Cryptocurrency investments carry significant risks.
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Cryptocurrency values can be extremely volatile</li>
                  <li>Past performance does not guarantee future results</li>
                  <li>You may lose some or all of your investment</li>
                  <li>Regulatory changes may affect platform operations</li>
                  <li>Technical issues may temporarily affect platform availability</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle>8. Account Termination</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  The platform reserves the right to suspend or terminate user accounts for violations of these terms,
                  suspicious activities, or legal requirements. Users may also close their accounts at any time by
                  contacting support.
                </p>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle>9. Limitation of Liability</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  Mintmine Pro shall not be liable for any direct, indirect, incidental, special, or consequential
                  damages resulting from the use or inability to use the platform, even if advised of the possibility of
                  such damages.
                </p>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle>10. Changes to Terms</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  These terms may be updated from time to time. Users will be notified of significant changes via email
                  or platform notifications. Continued use of the platform after changes constitutes acceptance of the
                  new terms.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>11. Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>For questions about these terms or the platform, please contact us at:</p>
                <p>
                  Email:mintminepro@mail.com
                  <br />
                  Support: Available 24/7 through the platform
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
