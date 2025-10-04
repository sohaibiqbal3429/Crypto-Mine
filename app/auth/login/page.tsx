import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030018] text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(165,243,252,0.16),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(244,114,182,0.12),_transparent_45%)]" />
      <div className="relative z-10 w-full max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="hidden rounded-[2.5rem] border border-white/15 bg-white/5 p-10 text-white shadow-[0_30px_80px_rgba(56,189,248,0.25)] lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-100/80">Apple Mine Ritual</p>
            <h1 className="mt-6 text-4xl font-bold leading-tight">Return to your luminous command deck.</h1>
            <p className="mt-4 text-sm text-white/70">
              Sign back into the Apple Mine habitat to orchestrate yield rituals, audit vault telemetry, and ignite crew missions. Every control surface has been re-imagined for this build.
            </p>
            <div className="mt-10 space-y-3 text-sm text-white/70">
              <p className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-cyan-300 pulse-beacon" />
                Instant access to bioluminescent dashboards
              </p>
              <p className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-fuchsia-300 pulse-beacon" />
                Dual-factor rituals on every withdrawal
              </p>
              <p className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-cyan-300 pulse-beacon" />
                Atmos interface crafted just for Apple Mine
              </p>
            </div>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
