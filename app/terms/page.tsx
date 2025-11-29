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
            <h1 className="text-3xl font-bold text-balance">Terms of Service / FAQ</h1>
            <p className="text-muted-foreground">Last updated: January 15, 2025</p>
          </div>

          <div className="space-y-6 lg:space-y-8">
            {/* 1 */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>1. What is MintMine Pro?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  MintMine Pro is a digital mining platform that allows users to earn daily profits
                  through secure and automated crypto mining. It’s designed for both beginners and
                  professionals to grow their digital income safely.
                </p>
              </CardContent>
            </Card>

            {/* 2 */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>2. How do I start mining on MintMine Pro?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  Simply create an account, verify your email, and choose a mining plan. Once you
                  make a deposit, your mining process will automatically begin, and you’ll start
                  earning daily rewards.
                </p>
              </CardContent>
            </Card>

            {/* 3 */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>3. What is the minimum deposit amount?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  The minimum deposit is <strong>30 USDT</strong>. Deposits below this amount are
                  not accepted. Higher deposits unlock better earning opportunities and bonuses.
                </p>
              </CardContent>
            </Card>

            {/* 4 */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>4. How much profit can I earn daily?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  Your daily profit depends on your selected plan. Basic users can earn between{" "}
                  <strong>1% – 1.5%</strong> daily, while higher-level plans offer increased profit
                  rates.
                </p>
              </CardContent>
            </Card>

            {/* 5 */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>5. How does the referral bonus system work?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  When you refer someone who deposits <strong>30 USDT</strong> or more, you receive
                  a <strong>15% bonus</strong> instantly as a depositor reward.
                </p>
                <p className="mt-2">
                  <em>Example:</em> If your referral deposits <strong>100 USDT</strong>, you earn{" "}
                  <strong>15 USDT</strong> directly into your account.
                </p>
              </CardContent>
            </Card>

            {/* 6 */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>6. Is there any joining fee?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  No. Joining MintMine Pro is completely free. You only need to deposit funds to
                  start your mining plan.
                </p>
              </CardContent>
            </Card>

            {/* 7 */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>7. How can I withdraw my earnings?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  Withdrawals can be made directly from your dashboard once you reach the minimum
                  withdrawal limit. All withdrawals are processed securely, usually within{" "}
                  <strong>24 hours</strong>.
                </p>
              </CardContent>
            </Card>

            {/* 8 */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>8. What payment methods are supported?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  MintMine Pro supports <strong>USDT (BEP-20)</strong> and other popular crypto
                  wallets. You can deposit and withdraw funds using these methods easily.
                </p>
              </CardContent>
            </Card>

            {/* 9 */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>9. Can I upgrade my mining plan later?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  Yes, you can upgrade your mining plan anytime. Upgrading increases your daily
                  profit percentage and overall mining performance.
                </p>
              </CardContent>
            </Card>

            {/* 10 */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>10. What should I do if I face any issue or delay?</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  If you encounter any problem or delay, please contact the MintMine Pro support
                  team through the <strong>“Help”</strong> or <strong>“Contact Us”</strong> section
                  in your dashboard for quick assistance.
                </p>
              </CardContent>
            </Card>

            {/* 11 New Withdrawal Policy */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>11. Updated Withdrawal & Account Policy</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>
                  From tonight after <strong>12 AM</strong>, only{" "}
                  <strong>profit withdrawals</strong> will be allowed, with a minimum of{" "}
                  <strong>30 USDT</strong>. <strong>Commission withdrawals</strong> will also be
                  allowed.
                </p>
                <p className="mt-2">
                  Besides this, we need some time because we are going to{" "}
                  <strong>
                    block the accounts of those users who have created more than one account
                  </strong>
                  . These users have forced us to impose strict policies to protect the system and
                  maintain fairness.
                </p>
                <p className="mt-3">
                  The final announcement of the new policy has been made. From{" "}
                  <strong>12 AM</strong>, profit withdrawals will start, and the{" "}
                  <strong>approval time will be 24 to 48 hours</strong>.
                </p>
                <p className="mt-2">
                  If a withdrawal is <strong>rejected twice</strong> and the member does not
                  resolve the stated reason, then on the <strong>third attempt</strong> the{" "}
                  <strong>account will be blocked</strong>.
                </p>
              </CardContent>
            </Card>

            {/* 12 Contact (email + highlighted Telegram) */}
            <Card>
              <CardHeader>
                <CardTitle>12. Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>For questions about these terms or the platform, please contact us at:</p>
                <p>
                  <strong>Email:</strong>{" "}
                  <a href="mailto:mintminepro@gmail.com">mintminepro@gmail.com</a>
                  <br />
                  <strong>Support:</strong> Available 24/7 through the platform
                  <br />
                  {/* 🔥 Highlighted Telegram ID */}
                  <strong>Telegram:</strong>{" "}
                  <a
                    href="https://t.me/GeorgeLiu87"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary"
                  >
                    @GeorgeLiu87
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
