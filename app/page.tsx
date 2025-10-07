import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Shield, Zap } from "lucide-react"
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
            Join our innovative mining ecosystem with automated earnings, advanced analytics, and sustainable
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
        <div className="mt-20 grid gap-8 md:grid-cols-2">
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
              <Shield className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold">Secure Platform</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Advanced security measures with transparent transaction tracking and admin oversight.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
