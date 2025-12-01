"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"

import { Sidebar } from "@/components/layout/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { CountdownBadge, CountdownDisplay } from "@/components/launch/countdown-display"
import { useLaunchCountdown } from "@/hooks/use-launch-countdown"

interface ListingHighlight {
  title: string
  description: string
  stat: string
  helper: string
}

interface ListingCard {
  name: string
  stage: string
  description: string
  launch: string
  interest: string
}
const INITIAL_SEGMENTS = [
  { unit: "days", value: 87 },
  { unit: "hours", value: 59 },
  { unit: "minutes", value: 59 },
  { unit: "seconds", value: 59 },
]

const HIGHLIGHTS: Record<"scheduled" | "live", ListingHighlight[]> = {
  scheduled: [
    {
      title: "Presales",
      description: "Curated access to the hottest early-stage token sales.",
      stat: "12",
      helper: "Live this quarter",
    },
    {
      title: "Airdrops",
      description: "Stay ahead with verified reward campaigns and quests.",
      stat: "28",
      helper: "Opportunities now",
    },
    {
      title: "DEX/CEX Listings",
      description: "Track centralized and decentralized launch partners.",
      stat: "7",
      helper: "Exchanges confirmed",
    },
    {
      title: "Launchpad",
      description: "Secure allocations with tiered staking advantages.",
      stat: "4",
      helper: "Upcoming cohorts",
    },
  ],
  live: [
    {
      title: "Presales",
      description: "Allocations unlocked with live on-chain settlement and waitlist auto-fill.",
      stat: "12",
      helper: "Now filling",
    },
    {
      title: "Airdrops",
      description: "Campaign quests are awarding instantly with verified wallet binding.",
      stat: "31",
      helper: "Live rewards",
    },
    {
      title: "DEX/CEX Listings",
      description: "Centralized & decentralized partners are executing liquidity boots.",
      stat: "9",
      helper: "Trading",
    },
    {
      title: "Launchpad",
      description: "Tiered staking bonuses now compounding for live cohorts.",
      stat: "5",
      helper: "In-session",
    },
  ],
}

const LISTINGS: ListingCard[] = [
  {
    name: "NebulaX Protocol",
    stage: "Presale",
    description: "AI-enhanced liquidity routing with deflationary tokenomics and governance staking.",
    launch: "Liquidity bootstrapping ongoing",
    interest: "18.4k joined",
  },
  {
    name: "HarborFi",
    stage: "DEX Launch",
    description: "Cross-chain stablecoin vaults bringing real-world yield to DeFi users worldwide.",
    launch: "Partners confirmed",
    interest: "12.1k joined",
  },
  {
    name: "Arcadia Nodes",
    stage: "Airdrop",
    description: "Validator incentives for powering a privacy-first smart contract network.",
    launch: "Questline curated",
    interest: "9.7k joined",
  },
]

const ECONOMICS_RULES = [
  {
    label: "Minimum Deposit",
    value: "$80+",
    scheduled: "Fund your wallet now to auto-qualify when mining opens.",
    live: "Deposits of $80 or more stay mining-eligible.",
  },
  {
    label: "Deposit Commission",
    value: "2%",
    scheduled: "One-time fee held until launch to secure infrastructure.",
    live: "Applied instantly on new deposits to feed liquidity pools.",
  },
  {
    label: "Daily Mining Yield",
    value: "Default 1.5%",
    scheduled: "Projected daily return once hashing begins.",
    live: "Compounded every cycle and streamed to balances.",
  },
  {
    label: "Team Rewards",
    value: "Auto-split",
    scheduled: "Invites accrue credits for Team Earnings and balance unlocks.",
    live: "Live overrides route straight into Team Earnings and Current Balance.",
  },
]

const PROGRESS_SNAPSHOTS: Record<"scheduled" | "live", { label: string; value: number; helper: string }[]> = {
  scheduled: [
    { label: "Launch readiness", value: 74, helper: "Security audit in review" },
    { label: "Whitelisted liquidity", value: 58, helper: "Market makers onboarding" },
  ],
  live: [
    { label: "Launch readiness", value: 100, helper: "Platform unlocked" },
    { label: "Whitelisted liquidity", value: 93, helper: "Depth online" },
  ],
}

export default function CoinsPage() {
  const [user, setUser] = useState<any>(null)
  const { countdown, phase, isReady } = useLaunchCountdown()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userRes = await fetch("/api/auth/me")
        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData.user)
        }
      } catch (error) {
        console.error("Failed to fetch user:", error)
      }
    }

    fetchUser()
  }, [])

  const handleJoinWaitlist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  const segments = useMemo(() => countdown?.segments ?? INITIAL_SEGMENTS, [countdown])
  const snapshotKey = phase === "live" ? "live" : "scheduled"
  const highlightSet = HIGHLIGHTS[snapshotKey]
  const progressSnapshot = PROGRESS_SNAPSHOTS[snapshotKey]

  const heroBadgeText = phase === "live" ? "Now Live" : "Launching Soon"
  const heroDescription =
    phase === "live"
      ? "Trading, mining, and liquidity programs are open. Secure your allocations and compound from day one."
      : "Discover upcoming tokens, presales, and exchange listings. We’re finalizing the platform—join the waitlist for day one access and instant alerts."

  return (
    <div className="flex min-h-screen bg-white text-black dark:bg-[#0A0A0A] dark:text-white">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto md:ml-64">
        <div className="px-6 py-12 lg:px-12">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <Badge
              variant="outline"
              className="mb-6 border-primary/40 bg-primary/5 text-primary transition-colors duration-[var(--t-med)] ease-[var(--ease)]"
            >
              {heroBadgeText}
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Coin Listings &amp; Launchpad
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">{heroDescription}</p>

            <form
              onSubmit={handleJoinWaitlist}
              className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
            >
              <Input
                type="email"
                placeholder="you@example.com"
                className="h-12 w-full rounded-full border border-gray-200 bg-white px-5 text-base text-black shadow-sm placeholder:text-gray-400 dark:border-white/10 dark:bg-[#1e1e1e] dark:text-white dark:placeholder:text-gray-500"
                aria-label="Email address"
              />
              <Button
                type="submit"
                className="inline-flex h-12 rounded-full bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#22c55e] px-8 text-base font-semibold text-white shadow-lg shadow-black/10 hover:opacity-90"
              >
                Notify me
              </Button>
            </form>

            <p className="mt-4 text-sm text-muted-foreground">No spam—just alpha when we go live.</p>

            <div className="mt-10 w-full">
              <CountdownDisplay segments={segments} phase={phase} />
              {!isReady && <p className="mt-3 text-xs text-muted-foreground">Syncing launch clock with the network…</p>}
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-6">
              {LISTINGS.map((listing) => (
                <Card
                  key={listing.name}
                  className="border border-black/5 bg-white text-black shadow-lg shadow-black/10 transition-colors hover:border-primary/40 hover:shadow-xl dark:border-white/5 dark:bg-[#1e1e1e] dark:text-white"
                >
                  <CardContent className="flex flex-col gap-4 p-6 text-left sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold text-black dark:text-white">
                          {listing.stage}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{listing.launch}</span>
                        <CountdownBadge segments={segments} phase={phase} />
                      </div>
                      <h3 className="mt-3 text-xl font-semibold tracking-tight">{listing.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground sm:max-w-md">{listing.description}</p>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <span className="text-sm font-medium text-muted-foreground">{listing.interest}</span>
                      {phase === "live" ? (
                        <Button variant="secondary" className="rounded-full px-6">
                          View live market
                        </Button>
                      ) : (
                        <Button variant="secondary" className="rounded-full px-6">
                          Join waitlist
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="h-full border border-black/5 bg-white text-black shadow-lg shadow-black/10 backdrop-blur-md dark:border-white/5 dark:bg-[#1e1e1e] dark:text-white">
              <CardContent className="flex h-full flex-col justify-between p-6">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Stay listing-ready</h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Tailor alerts to your strategy—filter by chain, sale stage, or exchange partners, and never miss an
                    allocation window again.
                  </p>
                </div>
                <div className="mt-8 space-y-5">
                  {highlightSet.map((highlight) => (
                    <div
                      key={highlight.title}
                      className="rounded-xl border border-black/5 bg-white p-4 transition-colors duration-[var(--t-med)] ease-[var(--ease)] dark:border-white/5 dark:bg-[#1e1e1e]"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                            {highlight.title}
                          </h3>
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{highlight.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-semibold text-primary">{highlight.stat}</span>
                          <p className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">{highlight.helper}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-xl border border-black/5 bg-white p-4 transition-colors duration-[var(--t-med)] ease-[var(--ease)] dark:border-white/5 dark:bg-[#1e1e1e]">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Mining Economics</h3>
                    <div className="mt-4 space-y-4">
                      {ECONOMICS_RULES.map((rule) => (
                        <div
                          key={rule.label}
                          className="flex items-start justify-between gap-4 rounded-lg border border-black/5 bg-white p-3 text-black shadow-sm shadow-black/5 dark:border-white/5 dark:bg-[#1e1e1e] dark:text-white"
                        >
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-600 dark:text-gray-400">{rule.label}</p>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                              {snapshotKey === "live" ? rule.live : rule.scheduled}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-primary">{rule.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 space-y-3">
                      {progressSnapshot.map((progress) => (
                        <div key={progress.label}>
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-gray-600 dark:text-gray-400">
                            <span>{progress.label}</span>
                            <span>{progress.value}%</span>
                          </div>
                          <Progress value={progress.value} className="mt-2 overflow-hidden">
                            <span className="sr-only">{progress.label}</span>
                          </Progress>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{progress.helper}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
