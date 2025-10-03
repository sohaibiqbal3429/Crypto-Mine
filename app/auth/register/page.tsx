import { Suspense } from "react"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--secondary))] to-[hsl(var(--muted))] p-4 text-foreground transition-colors dark:from-[#050505] dark:via-[#0a0a0a] dark:to-[#141414] sm:p-6">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Preparing form...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  )
}
