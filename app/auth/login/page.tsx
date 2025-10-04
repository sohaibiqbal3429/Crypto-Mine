import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#010b08] p-4 text-foreground sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(74,222,128,0.18),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(248,250,252,0.07),_transparent_50%)]" />
      <div className="relative z-10 w-full max-w-xl">
        <LoginForm />
      </div>
    </div>
  )
}
