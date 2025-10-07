import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, CalendarDays, Gift, Shield, Sparkles, Trophy, Users, Zap } from "lucide-react"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--secondary))] to-[hsl(var(--muted))] text-foreground transition-colors dark:from-[#050505] dark:via-[#0c0c0c] dark:to-[#161616]">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/60 dark:bg-[#101010]/80">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center space-x-2">
            <Image src="/images/logo.png" alt="Mintmine Pro" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold">Mintmine Pro</span>
          </div>
          <div className="flex items-center space-x-3">
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/register">
              <Button className="shadow-lg shadow-primary/20">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-balance text-5xl font-bold leading-tight sm:text-6xl">
            Next-Generation
            <span className="bg-gradient-to-r from-primary via-accent to-primary/80 bg-clip-text text-transparent">
              {" "}
              Crypto Mining{" "}
            </span>
            Platform
          </h1>
          <p className="mt-6 text-balance text-lg text-muted-foreground sm:text-xl">
            Join our innovative mining ecosystem with referral rewards, team building, and sustainable earning
            opportunities.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/auth/register">
              <Button size="lg" className="px-8 text-lg shadow-lg shadow-primary/25">
                Start Mining Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="px-8 text-lg">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid gap-8 md:grid-cols-3">
          <div className="group rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-primary/30">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30">
              <Zap className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold">Easy Mining</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Simple one-click mining with daily rewards and automated profit distribution.
            </p>
          </div>
          <div className="group rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-primary/30">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold">Team Building</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Build your network with referral rewards and multi-level commission structure.
            </p>
          </div>
          <div className="group rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-primary/30">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30">
              <Shield className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold">Secure Platform</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Advanced security measures with transparent transaction tracking and admin oversight.
            </p>
          </div>
        </div>

        {/* Blind Box Highlight */}
        <section className="mt-24">
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#ff6b6b] via-[#f06595] to-[#845ef7] text-white shadow-2xl">
            <div className="pointer-events-none absolute -top-32 -left-24 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="relative p-10 space-y-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-white/75">Blind Box Lucky Draw</p>
                  <h2 className="flex flex-wrap items-center gap-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                    <Gift className="h-8 w-8" /> Win Exciting Prizes Every 3 Days
                  </h2>
                  <p className="max-w-2xl text-base text-white/85">
                    Join the current blind box round for just $10.00 and stand a chance to win $30.00 instantly credited to your
                    balance. Rounds renew automatically, keeping the excitement alive for every miner in the community.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white">
                    <Sparkles className="h-4 w-4" /> 3 participants already joined
                  </span>
                  <Button
                    variant="secondary"
                    className="bg-white text-fuchsia-600 hover:bg-fuchsia-50 hover:text-fuchsia-700 shadow-lg"
                    asChild
                  >
                    <Link href="/auth/login">Sign In &amp; Join</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/15 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Entry Fee</p>
                  <p className="mt-2 text-2xl font-bold">$10.00</p>
                  <p className="text-sm text-white/80">Deducted instantly upon confirmation</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Prize Pool</p>
                  <p className="mt-2 text-2xl font-bold">$30.00</p>
                  <p className="text-sm text-white/80">Automatically credited to the winner</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Next Draw</p>
                  <p className="mt-2 text-lg font-semibold flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" /> Oct 10, 2025
                  </p>
                  <p className="text-sm text-white/80">14:32:51 UTC</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-white/85">
                <Trophy className="h-5 w-5" />
                <span>Winners are automatically credited and announced directly inside the dashboard history.</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
