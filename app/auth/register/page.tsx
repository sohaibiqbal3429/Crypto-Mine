import { Suspense } from "react"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030018] text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(129,230,217,0.18),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(244,114,182,0.12),_transparent_45%)]" />
      <div className="relative z-10 w-full max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1.2fr] lg:items-center">
          <div className="rounded-[2.75rem] border border-white/15 bg-white/5 p-10 text-white shadow-[0_35px_90px_rgba(14,165,233,0.32)]">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-100/80">Launch Sequence</p>
            <h1 className="mt-6 text-4xl font-bold leading-tight">Create your Apple Mine ident and step into the habitat.</h1>
            <p className="mt-4 text-sm text-white/70">
              This onboarding flow was crafted specifically for Apple Mine. Discover alliance bonuses, ritual-based security, and spectral dashboards the moment you finish verification.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <p className="text-sm font-semibold text-white">Crew Capsules</p>
                <p className="mt-2 text-xs text-white/60">Auto-tier alliances with transparent commission paths.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <p className="text-sm font-semibold text-white">Vault Safeguards</p>
                <p className="mt-2 text-xs text-white/60">Dual-channel verification keeps withdrawals pristine.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <p className="text-sm font-semibold text-white">Spectral UI</p>
                <p className="mt-2 text-xs text-white/60">Original gradients, typography, and cinematic loops.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <p className="text-sm font-semibold text-white">Global Reach</p>
                <p className="mt-2 text-xs text-white/60">Habitats operate seamlessly across 140+ territories.</p>
              </div>
            </div>
          </div>
          <Suspense fallback={<div className="rounded-3xl border border-white/15 bg-black/40 p-8 text-sm text-white/70">Preparing habitat controls…</div>}>
            <RegisterForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
