import { Suspense } from "react"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Preparing form...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  )
}
