import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Activity,
  Atom,
  Compass,
  Flame,
  LineChart,
  Orbit,
  ShieldHalf,
  Sparkles,
  Waves,
  Zap,
} from "lucide-react"

const navigation = [
  { label: "Command Deck", href: "/dashboard" },
  { label: "Live Reactors", href: "/mining" },
  { label: "Vaults", href: "/wallet" },
  { label: "Alliances", href: "/team" },
  { label: "Support", href: "/support" },
]

const heroMetrics = [
  { value: "0.7s", label: "Command latency" },
  { value: "3.4M", label: "Signals orchestrated" },
  { value: "142", label: "Habitats online" },
]

const systemPillars = [
  {
    title: "Adaptive Yield Engines",
    description:
      "Auto-balancing pods flex rewards in real time using liquidity sensing, solar arbitrage, and crew streaks.",
    icon: LineChart,
  },
  {
    title: "Arc-Shield Security",
    description:
      "Hardware keys, biometric rituals, and anomaly mirroring keep every vault and withdrawal hardened.",
    icon: ShieldHalf,
  },
  {
    title: "Atmos Interface",
    description:
      "Fluid motion design, spectral typography, and story-driven telemetry craft an unmistakable Apple Mine feel.",
    icon: Orbit,
  },
]

const ritualTimeline = [
  {
    title: "Ignite your ident",
    blurb: "Choose a spectral alias, authenticate with email or phone, and tune your crew preferences in one flow.",
  },
  {
    title: "Assemble the circuit",
    blurb:
      "Deploy referral constellations, tag operations by goal, and watch heatmaps react to every invite and deposit.",
  },
  {
    title: "Harvest the lumen",
    blurb:
      "Trigger bioluminescent mining cycles, queue instant vault draws, and schedule auto-withdraw rituals.",
  },
]

const habitatModules = [
  {
    heading: "Signal Studio",
    copy:
      "Design goal-based mining playbooks with modular automation, swap signal weights on the fly, and broadcast rituals to your crew.",
    accent: "Blueprint your earning choreography",
  },
  {
    heading: "Vault Whisper",
    copy:
      "See every deposit, stake, and withdrawal in cinematic timelines. Predict liquidity drift before it hits your wallet.",
    accent: "Command vault clarity",
  },
  {
    heading: "Alliance Pulse",
    copy:
      "Monitor crew energy across time zones, track layered commissions, and activate flash missions for instant boosts.",
    accent: "Keep your network luminous",
  },
]

const testimonials = [
  {
    quote:
      "Apple Mine doesn't feel like a fork of anything. The ritual-based dashboard and spectral cues are unlike the clones we tested.",
    author: "Helena M.",
    role: "Community Cartographer",
  },
  {
    quote:
      "Our crew loves the Atmos interface. The mining loops are cinematic without sacrificing the raw control we need.",
    author: "Koji I.",
    role: "Crew Lead, Neon Sector",
  },
]

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020312] text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(110,238,255,0.18),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(252,165,255,0.12),_transparent_50%)]" />
      <div className="pointer-events-none absolute -inset-x-48 top-48 h-[640px] rounded-full bg-[conic-gradient(from_90deg,_rgba(125,211,252,0.18),_rgba(244,114,182,0.22),_rgba(110,238,255,0.18))] blur-[140px]" />

      <header className="relative z-20 border-b border-white/10 bg-black/25 backdrop-blur-xl">
        <div className="container mx-auto flex flex-col gap-5 px-5 py-6 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-fuchsia-400 text-2xl font-black text-slate-950 shadow-[0_0_30px_rgba(165,243,252,0.35)] transition-transform group-hover:rotate-6">
              🍏
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.4em] text-cyan-100/70">Apple Mine</p>
              <p className="-mt-1 text-base font-medium text-white/80">Luminous Mining Habitat</p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-white/70 md:gap-8">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                Access
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button className="bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 text-slate-950 shadow-lg shadow-cyan-500/30 hover:from-cyan-300 hover:via-sky-300 hover:to-fuchsia-400">
                Launch Habitat
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="container mx-auto grid gap-16 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-9">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              New Spectral Build
            </span>
            <h1 className="text-balance text-4xl font-black leading-tight text-white sm:text-5xl md:text-6xl">
              Orchestrate mining rituals inside the <span className="spectral-text">Apple Mine</span> habitat.
            </h1>
            <p className="max-w-2xl text-lg text-white/70 sm:text-xl">
              Apple Mine is a cinematic mining experience forged from bioluminescent data streams, adaptive yield engines, and collaborative crew rituals. Nothing about this interface feels templated or borrowed.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/auth/register">
                <Button size="lg" className="h-12 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 px-8 text-base font-semibold text-slate-950 shadow-xl shadow-cyan-500/30 hover:from-cyan-300 hover:via-sky-300 hover:to-fuchsia-400">
                  Begin Initiation
                </Button>
              </Link>
              <Link href="#rituals" className="group inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white">
                <Waves className="h-4 w-4 transition group-hover:translate-x-1" />
                View Ritual Timeline
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {heroMetrics.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
                  <p className="text-3xl font-bold">{metric.value}</p>
                  <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/70">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-cyan-400/20 via-sky-500/10 to-fuchsia-400/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2.75rem] border border-white/10 bg-black/40 p-8 shadow-[0_30px_70px_rgba(56,189,248,0.4)]">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                <span>Live Reactor Stack</span>
                <Zap className="h-4 w-4" />
              </div>
              <div className="mt-10 space-y-6 text-white/80">
                <div className="rounded-3xl border border-cyan-400/40 bg-cyan-400/10 p-6">
                  <div className="flex items-center justify-between text-sm">
                    <span>Flux Chamber</span>
                    <span className="font-semibold text-cyan-100">+18.6%</span>
                  </div>
                  <h3 className="mt-3 flex items-center gap-3 text-2xl font-semibold text-white">
                    <Flame className="h-6 w-6 text-fuchsia-300" />
                    Aurora Node
                  </h3>
                  <p className="mt-3 text-sm text-white/70">
                    Autonomous yield cycles blend solar arbitrage with liquidity sensing to maximise return per ritual.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60">Crew Charge</p>
                    <p className="mt-2 text-2xl font-semibold text-white">Radiant</p>
                    <p className="mt-2 text-xs text-white/60">Orbit boosters activated</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60">Vault Drift</p>
                    <p className="mt-2 text-2xl font-semibold text-white">0.3%</p>
                    <p className="mt-2 text-xs text-white/60">Within tolerance band</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-cyan-400/40 bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 p-6 text-sm">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/70">Alliance Signal</p>
                  <p className="mt-2 text-lg font-semibold text-white">Pulse: 52 operatives active</p>
                  <p className="mt-3 text-xs text-white/60">Next milestone unlocks +4% harmonic yield surge.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-5 pb-20">
          <div className="grid gap-10 lg:grid-cols-3">
            {systemPillars.map((pillar) => (
              <div
                key={pillar.title}
                className="habitat-card group relative overflow-hidden rounded-[2.25rem] bg-white/5 p-8"
              >
                <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-400/20 blur-2xl transition-opacity group-hover:opacity-100" />
                <pillar.icon className="h-10 w-10 text-cyan-200" />
                <h3 className="mt-6 text-2xl font-semibold text-white">{pillar.title}</h3>
                <p className="mt-4 text-sm text-white/70">{pillar.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="rituals" className="border-t border-white/10 bg-white/[0.03]">
          <div className="container mx-auto grid gap-14 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                <Compass className="h-4 w-4" />
                Ritual Flow
              </span>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">The Apple Mine initiation path</h2>
              <p className="text-white/70">
                Every frame of the journey was bespoke-crafted for this habitat. Move through initiation, alliance building, and daily harvest without ever seeing a recycled screen.
              </p>
              <Link href="/auth/register">
                <Button variant="outline" className="rounded-full border-white/30 bg-transparent px-8 py-6 text-white hover:bg-white/10">
                  Enter the initiation deck
                </Button>
              </Link>
            </div>
            <div className="space-y-6">
              {ritualTimeline.map((step, index) => (
                <div key={step.title} className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-6">
                  <div className="absolute -left-6 top-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-400 to-fuchsia-400 text-base font-semibold text-slate-950 shadow-lg">
                    0{index + 1}
                  </div>
                  <div className="ml-12">
                    <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm text-white/70">{step.blurb}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto grid gap-10 px-5 pb-20 pt-16 lg:grid-cols-3">
          {habitatModules.map((module) => (
            <div key={module.heading} className="habitat-card rounded-[2.5rem] bg-black/40 p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-100/80">{module.accent}</p>
              <h3 className="mt-4 text-2xl font-semibold text-white">{module.heading}</h3>
              <p className="mt-4 text-sm text-white/70">{module.copy}</p>
            </div>
          ))}
        </section>

        <section className="border-y border-white/10 bg-black/30">
          <div className="container mx-auto grid gap-12 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                <Atom className="h-4 w-4" />
                Atmos Layer
              </span>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Every panel is unmistakably Apple Mine</h2>
              <p className="text-white/70">
                From spectral gradients to choreographed microinteractions, the interface rejects copycat patterns. The habitat feels alive, responsive, and purpose-built for the community.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-white/70">
                <div className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2">
                  <Activity className="h-4 w-4" />
                  Bio-feedback mining cues
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2">
                  <Orbit className="h-4 w-4" />
                  Crew constellation view
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2">
                  <Zap className="h-4 w-4" />
                  Instant ritual triggers
                </div>
              </div>
            </div>
            <div className="grid gap-6">
              {testimonials.map((testimonial) => (
                <div key={testimonial.author} className="habitat-card rounded-[2rem] bg-white/5 p-8 text-white">
                  <p className="text-lg italic text-white/80">“{testimonial.quote}”</p>
                  <div className="mt-6 text-sm text-white/60">
                    <p className="font-semibold text-white">{testimonial.author}</p>
                    <p>{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-5 pb-28 pt-16">
          <div className="relative overflow-hidden rounded-[3rem] border border-white/15 bg-gradient-to-br from-cyan-400/15 via-sky-400/10 to-fuchsia-400/20 p-10 text-center shadow-[0_35px_80px_rgba(56,189,248,0.3)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.14),_transparent_60%)]" />
            <div className="relative space-y-6 text-white">
              <h2 className="text-3xl font-bold sm:text-4xl">Ready to occupy a luminous mining habitat?</h2>
              <p className="mx-auto max-w-3xl text-sm sm:text-base text-white/80">
                Ignite your Apple Mine identity and orchestrate rituals that feel hand-crafted for your collective. The ecosystem is live, the reactors are primed, and the experience is unmistakably original.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/auth/register">
                  <Button size="lg" className="h-12 rounded-full bg-white px-10 text-base font-semibold text-slate-950 hover:bg-slate-100">
                    Start the Sequence
                  </Button>
                </Link>
                <Link href="/support">
                  <Button variant="outline" size="lg" className="h-12 rounded-full border-white/40 bg-transparent px-10 text-base font-semibold text-white hover:bg-white/10">
                    Talk to Support Navigators
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-black/40">
        <div className="container mx-auto flex flex-col gap-3 px-5 py-8 text-center text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Apple Mine. Crafted for luminous crews.</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/support" className="hover:text-white">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
