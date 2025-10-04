import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  CircleDashed,
  Gem,
  Leaf,
  Pickaxe,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

const featureHighlights = [
  {
    title: "Orchard Mining Pods",
    description:
      "Spin up immersive mining pods that blend gamified orchard visuals with precise earnings data and smart automation.",
    icon: Pickaxe,
  },
  {
    title: "Collective Harvest",
    description:
      "Empower your crew with layered referral rewards, collaborative streaks, and storytelling dashboards that celebrate wins.",
    icon: Leaf,
  },
  {
    title: "Vault-Grade Guardrails",
    description:
      "Defend every transaction with multifactor checkpoints, anomaly detection, and real-time ledger transparency.",
    icon: ShieldCheck,
  },
]

const journeySteps = [
  {
    title: "Plant Your Node",
    detail: "Create your Apple Mine identity in under a minute with secure email or global phone authentication.",
  },
  {
    title: "Nurture Your Network",
    detail: "Invite cultivators, unlock layered yields, and monitor orchard health with intuitive growth analytics.",
  },
  {
    title: "Harvest Daily",
    detail: "Trigger luminous mining sessions, collect auto-compounded rewards, and withdraw with zero friction.",
  },
]

const impactStats = [
  { value: "98.4%", label: "Average Daily Uptime" },
  { value: "72k+", label: "Rewards Distributed" },
  { value: "140", label: "Countries Mining Together" },
]

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030910] text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(74,222,128,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(250,204,21,0.08),_transparent_45%)]" />

      <header className="relative z-10 border-b border-white/5 bg-white/5 backdrop-blur-xl">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-400 via-emerald-500 to-amber-400 text-2xl font-black text-emerald-950 shadow-[0_0_25px_rgba(34,197,94,0.35)] transition-transform group-hover:rotate-6">
              🍏
            </div>
            <div>
              <p className="text-lg font-semibold uppercase tracking-[0.3em] text-emerald-200/80">Apple Mine</p>
              <p className="-mt-1 text-sm font-medium text-emerald-100/70">Cultivate Digital Wealth</p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-emerald-100/80 md:gap-8">
            <Link href="/dashboard" className="transition hover:text-emerald-200">
              Platform
            </Link>
            <Link href="/mining" className="transition hover:text-emerald-200">
              Mining Arena
            </Link>
            <Link href="/wallet" className="transition hover:text-emerald-200">
              Wallet
            </Link>
            <Link href="/support" className="transition hover:text-emerald-200">
              Support
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="outline" className="border-emerald-400/40 bg-emerald-400/5 text-emerald-100 hover:bg-emerald-400/20">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button className="bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300 text-emerald-950 shadow-lg shadow-emerald-400/25 hover:from-emerald-300 hover:via-lime-300 hover:to-amber-200">
                Join the Orchard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="container mx-auto px-4 pb-24 pt-16 md:pt-24">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                Orchard-Powered Mining
              </span>
              <h1 className="text-balance text-4xl font-black leading-tight text-white sm:text-5xl md:text-6xl">
                Harvest luminous rewards with the reimagined <span className="bg-gradient-to-r from-emerald-200 via-lime-200 to-amber-200 bg-clip-text text-transparent">Apple Mine</span> universe.
              </h1>
              <p className="max-w-2xl text-lg text-emerald-100/70 sm:text-xl">
                Apple Mine distills pro-grade crypto infrastructure into a cinematic experience. Navigate glowing grids,
                coordinate mining parties, and withdraw earnings inside a serene, orchard-inspired interface.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link href="/auth/register">
                  <Button size="lg" className="h-14 rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300 px-10 text-base font-semibold text-emerald-950 shadow-xl shadow-emerald-400/30">
                    Launch My Pod
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="lg" variant="outline" className="h-14 rounded-full border-emerald-400/40 bg-transparent px-10 text-base text-emerald-100 transition hover:bg-emerald-400/10">
                    I already cultivate here
                  </Button>
                </Link>
              </div>
              <div className="grid gap-6 sm:grid-cols-3">
                {impactStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_25px_rgba(15,118,110,0.15)]">
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                    <p className="text-sm font-medium uppercase tracking-wider text-emerald-100/70">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-emerald-500/20 via-lime-400/10 to-amber-300/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/40 p-8 shadow-[0_25px_60px_rgba(15,118,110,0.45)]">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100/60">
                  <span>Live Yield Matrix</span>
                  <CircleDashed className="h-4 w-4" />
                </div>
                <div className="mt-8 space-y-6">
                  <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6">
                    <div className="flex items-center justify-between text-sm text-emerald-100/80">
                      <span>Flux Reactor</span>
                      <span>+12.4%</span>
                    </div>
                    <h3 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-white">
                      <Gem className="h-6 w-6 text-amber-300" />
                      Aurora Cluster
                    </h3>
                    <p className="mt-3 text-sm text-emerald-100/60">
                      Autonomous pod compounding every 24h with orchard synergy boosts and AI-powered balancing.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-emerald-100/80">
                      <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Crew Level</p>
                      <p className="mt-2 text-2xl font-semibold text-white">Legendary</p>
                      <p className="mt-2 text-xs text-emerald-100/60">5-tier orchard boosters unlocked</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-emerald-100/80">
                      <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Daily Harvest</p>
                      <p className="mt-2 text-2xl font-semibold text-white">642 P-Coins</p>
                      <p className="mt-2 text-xs text-emerald-100/60">Auto-credited to vault wallet</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/20 to-amber-400/20 p-6 text-sm text-emerald-50/90">
                    <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Referral Streak</p>
                    <p className="mt-2 text-xl font-semibold text-white">Team Orchard: 48 active growers</p>
                    <p className="mt-3 text-xs text-emerald-100/60">
                      Harvest synergy bonus active • Next milestone unlocks +3% yield amplification.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-24">
          <div className="grid gap-12 lg:grid-cols-3">
            {featureHighlights.map((feature) => (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 transition-transform duration-300 hover:-translate-y-2 hover:bg-white/10"
              >
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl transition-opacity group-hover:opacity-100" />
                <feature.icon className="h-10 w-10 text-emerald-300" />
                <h3 className="mt-6 text-2xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-4 text-sm text-emerald-100/70">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/5 bg-white/[0.02]">
          <div className="container mx-auto grid gap-12 px-4 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Your Apple Mine journey</h2>
              <p className="text-emerald-100/70">
                Designed for clarity, the Apple Mine flow guides you from onboarding to consistent harvesting with cinematic
                visuals and precise metrics.
              </p>
              <Link href="/auth/register">
                <Button variant="outline" className="rounded-full border-emerald-400/40 bg-transparent px-8 py-6 text-emerald-100 hover:bg-emerald-400/10">
                  Explore the onboarding ritual
                </Button>
              </Link>
            </div>
            <div className="space-y-6">
              {journeySteps.map((step, index) => (
                <div key={step.title} className="relative rounded-3xl border border-white/8 bg-white/6 p-6">
                  <div className="absolute -left-6 top-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-lime-400 to-amber-300 text-base font-semibold text-emerald-950 shadow-lg">
                    0{index + 1}
                  </div>
                  <div className="ml-10">
                    <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm text-emerald-100/70">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-28 pt-16">
          <div className="relative overflow-hidden rounded-[3rem] border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 via-emerald-400/15 to-amber-400/25 p-10 text-center shadow-[0_30px_60px_rgba(34,197,94,0.25)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15),_transparent_60%)]" />
            <div className="relative space-y-6">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Ready to cultivate a brilliant mining orchard?
              </h2>
              <p className="mx-auto max-w-2xl text-base text-emerald-100/80">
                Apple Mine fuses handcrafted aesthetics with resilient infrastructure. Join thousands of orchard pioneers who
                mine together, strategize together, and grow together.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/auth/register">
                  <Button size="lg" className="h-14 rounded-full bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300 px-10 text-base font-semibold text-emerald-950">
                    Create account
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="lg" variant="outline" className="h-14 rounded-full border-white/40 bg-white/10 px-10 text-base text-white hover:bg-white/20">
                    Access my orchard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
