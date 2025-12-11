import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Shield, Zap } from "lucide-react"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-signal text-slate-50">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <Image src="/images/mesh.svg" alt="mesh" fill className="object-cover" priority />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.12),transparent_40%)]" />

      {/* Header */}
      <header className="relative border-b border-slate-800/70 bg-slate-950/70 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-800/70 bg-gradient-to-br from-emerald-500/20 via-cyan-400/10 to-blue-500/10 text-cyan-200 shadow-lg shadow-emerald-500/15">
              <span className="text-lg font-black drop-shadow">5G</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-emerald-200">5gbotify</p>
              <p className="text-sm text-slate-300">Signal-grade orchestration</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Link href="/auth/login">
              <Button variant="ghost" className="border border-slate-800/70 bg-slate-900/60 text-slate-200 hover:border-emerald-400/70">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 text-slate-950 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.8)]">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative container mx-auto px-4 py-14 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase text-emerald-100">
              Network harvester ready
            </p>
            <h1 className="text-balance text-4xl font-bold leading-tight sm:text-5xl">
              Run a <span className="text-emerald-300">5G-grade</span> mining surface that looks nothing like MintMine Pro.
            </h1>
            <p className="text-balance text-lg text-slate-300">
              5gbotify ships a top-nav, telemetry-first interface with sharper edges, darker canvas, and bright neon accents.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/register">
                <Button size="lg" className="h-12 min-w-[200px] bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/30 hover:bg-emerald-300">
                  Start boosting
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="lg" variant="outline" className="h-12 min-w-[200px] border-slate-700 bg-slate-900/60 text-slate-100 hover:border-cyan-400/70">
                  I already have an account
                </Button>
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Latency monitor</p>
                <p className="mt-2 text-2xl font-semibold text-white">42 ms</p>
                <p className="text-sm text-slate-400">Average pipeline handshake time.</p>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Crew online</p>
                <p className="mt-2 text-2xl font-semibold text-white">+1,280</p>
                <p className="text-sm text-slate-400">Operators active in the 5g mesh.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-6 shadow-2xl shadow-emerald-500/20">
              <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl" />
              <div className="absolute -bottom-14 -right-12 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Orbit preview</p>
                  <span className="rounded-md bg-slate-800 px-3 py-1 text-[11px] font-semibold text-emerald-200">alpha ring</span>
                </div>
                <div className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Boost aperture</span>
                    <span className="font-semibold text-emerald-200">Ready</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-800">
                    <div className="h-full w-5/6 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500" />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Engine tuned for single-tap acceleration.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">Cycle ETA</p>
                    <p className="mt-1 text-xl font-semibold text-white">02:14:09</p>
                    <p className="text-xs text-slate-400">Until next auto-open window.</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Throttle</p>
                    <p className="mt-1 text-xl font-semibold text-white">Adaptive</p>
                    <p className="text-xs text-slate-400">Governed by fraud guards.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="group rounded-2xl border border-slate-800/70 bg-slate-900/80 p-6 shadow-xl shadow-emerald-500/10 transition duration-200 hover:-translate-y-1 hover:border-emerald-400/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Signal-first mining</h3>
                  <p className="text-sm text-slate-400">Trigger boost cycles with clear telemetry and fast feedback.</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-emerald-300 opacity-70 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>
          </div>
          <div className="group rounded-2xl border border-slate-800/70 bg-slate-900/80 p-6 shadow-xl shadow-cyan-500/10 transition duration-200 hover:-translate-y-1 hover:border-cyan-400/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Operational security</h3>
                  <p className="text-sm text-slate-400">Layered protections keep payouts clean and auditable.</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-cyan-300 opacity-70 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
