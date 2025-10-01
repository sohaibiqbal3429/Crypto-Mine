import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Shield, Users, Zap } from "lucide-react"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-50 to-amber-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/images/logo.png" alt="Mintmine Pro" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold">Mintmine Pro</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-balance mb-6">
            Next-Generation
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-700">
              {" "}
              Crypto Mining{" "}
            </span>
            Platform
          </h1>
          <p className="text-xl text-muted-foreground text-balance mb-8">
            Join our innovative mining ecosystem with referral rewards, team building, and sustainable earning
            opportunities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="text-lg px-8">
                Start Mining Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Easy Mining</h3>
            <p className="text-muted-foreground">
              Simple one-click mining with daily rewards and automated profit distribution.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Team Building</h3>
            <p className="text-muted-foreground">
              Build your network with referral rewards and multi-level commission structure.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure Platform</h3>
            <p className="text-muted-foreground">
              Advanced security measures with transparent transaction tracking and admin oversight.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
