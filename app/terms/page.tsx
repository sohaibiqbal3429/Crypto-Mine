"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

const sections = [
  {
    title: "1. Acceptance of Habitat Terms",
    body: (
      <p>
        Accessing Apple Mine means you agree to our luminous habitat terms. If you disagree with any ritual, refrain from
        using the platform until alignment is achieved.
      </p>
    ),
  },
  {
    title: "2. Platform Identity",
    body: (
      <p>
        Apple Mine is a bespoke mining habitat offering adaptive yield engines, cinematic dashboards, and secure vault
        management. Nothing here is cloned; the experience is engineered specifically for this ecosystem.
      </p>
    ),
  },
  {
    title: "3. Crew Responsibilities",
    body: (
      <ul className="list-disc space-y-2 pl-6">
        <li>Provide accurate details during onboarding and keep them current.</li>
        <li>Protect your credentials and ritual devices; never share OTP codes.</li>
        <li>Operate in compliance with your local regulations.</li>
        <li>Avoid malicious automation, scraping, or attempts to replicate our interface.</li>
        <li>Understand that crypto operations carry financial risk.</li>
      </ul>
    ),
  },
  {
    title: "4. Mining & Rewards",
    body: (
      <p>
        Rewards fluctuate based on reactor performance, liquidity balancing, and crew streaks. Sessions can be launched
        every 24 hours, and the platform may adjust formulas to maintain system integrity.
      </p>
    ),
  },
  {
    title: "5. Deposits & Withdrawals",
    body: (
      <p>
        Deposits begin at $80 USDT. Withdrawals start at $10 USDT and are typically processed within 24–48 hours. A 2%
        withdrawal fee covers chain and security costs. Additional checks may be required for large transfers.
      </p>
    ),
  },
  {
    title: "6. Alliance Program",
    body: (
      <p>
        Referral and alliance rewards are transparent and dynamic. Abuse—including fake accounts or circular activity—will
        result in removal and possible suspension.
      </p>
    ),
  },
  {
    title: "7. Risk Signals",
    body: (
      <ul className="list-disc space-y-2 pl-6">
        <li>Crypto values are volatile; earnings can rise or fall without notice.</li>
        <li>Historical results do not promise future performance.</li>
        <li>Technical or regulatory events may temporarily limit access.</li>
        <li>You are responsible for the tax treatment of your activity.</li>
      </ul>
    ),
  },
  {
    title: "8. Account Suspension",
    body: (
      <p>
        We may restrict or suspend accounts engaged in fraud, regulatory violations, or behaviour that harms the community.
        You may close your account by contacting support at any time.
      </p>
    ),
  },
  {
    title: "9. Liability Boundaries",
    body: (
      <p>
        Apple Mine is not liable for indirect, incidental, or consequential losses arising from platform use, network
        outages, or third-party integrations.
      </p>
    ),
  },
  {
    title: "10. Evolving Rituals",
    body: (
      <p>
        Terms may evolve as the habitat grows. When we update them, you will receive notifications. Continuing to use Apple
        Mine after updates counts as acceptance of the new ritual.
      </p>
    ),
  },
]

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
    <div className="flex h-screen bg-gradient-to-br from-[#030614] via-[#04091f] to-[#0a0215] text-foreground">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto md:ml-72">
        <div className="relative px-6 pb-16 pt-10">
          <div className="pointer-events-none absolute inset-x-12 top-0 h-48 rounded-[4rem] bg-[radial-gradient(circle,_rgba(244,114,182,0.18),_transparent_70%)] blur-3xl" />
          <div className="relative z-10 mb-10 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 text-white shadow-[0_35px_90px_rgba(244,114,182,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/70">Habitat Terms</p>
            <h1 className="mt-4 text-3xl font-bold">Apple Mine Manifest</h1>
            <p className="mt-2 text-sm text-white/70">Last updated: February 12, 2025</p>
          </div>

          <div className="relative z-10 grid gap-6 pb-20">
            {sections.map((section) => (
              <Card key={section.title} className="rounded-[2rem] border border-white/10 bg-black/40 text-white">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-white">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-invert prose-sm max-w-none text-white/70">{section.body}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
