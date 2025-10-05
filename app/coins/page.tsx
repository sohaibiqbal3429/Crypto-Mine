"use client"

import { FormEvent, useEffect, useState } from "react"

import { Sidebar } from "@/components/layout/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface ListingHighlight {
  title: string
  description: string
  stat: string
  helper: string
}

interface UpcomingListing {
  name: string
  stage: string
  description: string
  launch: string
  interest: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

const LISTING_HIGHLIGHTS: ListingHighlight[] = [
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
]

const UPCOMING_LISTINGS: UpcomingListing[] = [
  {
    name: "NebulaX Protocol",
    stage: "Presale",
    description: "AI-enhanced liquidity routing with deflationary tokenomics and governance staking.",
    launch: "Q3 · 2024",
    interest: "18.4k joined",
  },
  {
    name: "HarborFi",
    stage: "DEX Launch",
    description: "Cross-chain stablecoin vaults bringing real-world yield to DeFi users worldwide.",
    launch: "Q4 · 2024",
    interest: "12.1k joined",
  },
  {
    name: "Arcadia Nodes",
    stage: "Airdrop",
    description: "Validator incentives for powering a privacy-first smart contract network.",
    launch: "Q1 · 2025",
    interest: "9.7k joined",
  },
]

const MILLISECONDS_IN_SECOND = 1000
const MILLISECONDS_IN_MINUTE = 60 * MILLISECONDS_IN_SECOND
const MILLISECONDS_IN_HOUR = 60 * MILLISECONDS_IN_MINUTE
const MILLISECONDS_IN_DAY = 24 * MILLISECONDS_IN_HOUR

const DEFAULT_LAUNCH_TIMESTAMP = Date.UTC(2025, 0, 15, 0, 0, 0)
const ENVIRONMENT_LAUNCH_TIMESTAMP = Number(process.env.NEXT_PUBLIC_COIN_LAUNCH_TIMESTAMP ?? 0)
const COIN_LAUNCH_TIMESTAMP =
  Number.isFinite(ENVIRONMENT_LAUNCH_TIMESTAMP) && ENVIRONMENT_LAUNCH_TIMESTAMP > 0
    ? ENVIRONMENT_LAUNCH_TIMESTAMP
    : DEFAULT_LAUNCH_TIMESTAMP

function calculateTimeLeft(target: number): TimeLeft {
  const difference = Math.max(target - Date.now(), 0)

  const days = Math.floor(difference / MILLISECONDS_IN_DAY)
  const hours = Math.floor((difference % MILLISECONDS_IN_DAY) / MILLISECONDS_IN_HOUR)
  const minutes = Math.floor((difference % MILLISECONDS_IN_HOUR) / MILLISECONDS_IN_MINUTE)
  const seconds = Math.floor((difference % MILLISECONDS_IN_MINUTE) / MILLISECONDS_IN_SECOND)

  return { days, hours, minutes, seconds }
}

export default function CoinsPage() {
  const [user, setUser] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(COIN_LAUNCH_TIMESTAMP))

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

  useEffect(() => {
    const updateCountdown = () => {
      setTimeLeft(calculateTimeLeft(COIN_LAUNCH_TIMESTAMP))
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)

    return () => clearInterval(timer)
  }, [])

  const handleJoinWaitlist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto md:ml-64">
        <div className="px-6 py-12 lg:px-12">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <Badge variant="outline" className="mb-6 border-primary/40 bg-primary/5 text-primary">
              Launching Soon
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Coin Listings &amp; Launchpad
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
              Discover upcoming tokens, presales, and exchange listings. We&apos;re finalizing the platform—join the
              waitlist for day one access and instant alerts.
            </p>

            <form
              onSubmit={handleJoinWaitlist}
              className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
            >
              <Input
                type="email"
                placeholder="you@example.com"
                className="h-12 rounded-full border-muted bg-background/80 px-5 text-base shadow-sm"
                aria-label="Email address"
              />
              <Button type="submit" className="h-12 rounded-full px-8 text-base font-semibold shadow-lg">
                Notify me
              </Button>
            </form>

            <p className="mt-4 text-sm text-muted-foreground">No spam—just alpha when we go live.</p>

            <div className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(timeLeft).map(([label, value]) => (
                <Card key={label} className="border-muted/50 bg-background/80 shadow-sm backdrop-blur">
                  <CardContent className="flex flex-col items-center gap-1 py-6">
                    <span className="text-3xl font-semibold tabular-nums sm:text-4xl">{value.toString().padStart(2, "0")}</span>
                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      {label}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-6">
              {UPCOMING_LISTINGS.map((listing) => (
                <Card
                  key={listing.name}
                  className="border-muted/60 bg-background/90 shadow-sm transition-colors hover:border-primary/40 hover:shadow-md"
                >
                  <CardContent className="flex flex-col gap-4 p-6 text-left sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                          {listing.stage}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{listing.launch}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold tracking-tight">{listing.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground sm:max-w-md">{listing.description}</p>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <span className="text-sm font-medium text-muted-foreground">{listing.interest}</span>
                      <Button variant="secondary" className="rounded-full px-6">
                        Join waitlist
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="h-full border-muted/60 bg-background/90 shadow-sm backdrop-blur">
              <CardContent className="flex h-full flex-col justify-between p-6">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Stay listing-ready</h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Tailor alerts to your strategy—filter by chain, sale stage, or exchange partners, and never miss an
                    allocation window again.
                  </p>
                </div>
                <div className="mt-8 space-y-4">
                  {LISTING_HIGHLIGHTS.map((highlight) => (
                    <div key={highlight.title} className="rounded-xl border border-muted/40 bg-background/60 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            {highlight.title}
                          </h3>
                          <p className="mt-2 text-sm text-muted-foreground/80">{highlight.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-semibold text-primary">{highlight.stat}</span>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{highlight.helper}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
