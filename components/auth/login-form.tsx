"use client"

import Link from "next/link"
import { useFormState, useFormStatus } from "react-dom"
import { Loader2, UserRoundPlus } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction, type AuthFormState } from "@/app/auth/actions"

const initialState: AuthFormState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="flex-1 h-11 bg-black hover:bg-black/90" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Logging in...
        </>
      ) : (
        "Login"
      )}
    </Button>
  )
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState)

  return (
    <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
      <div className="bg-black text-white text-center py-4">
        <h1 className="text-lg font-semibold tracking-wide">User Referral Login System</h1>
      </div>

      <div className="px-8 py-6 space-y-6">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full border border-slate-300 flex items-center justify-center text-slate-600">
            <UserRoundPlus className="w-8 h-8" />
          </div>
        </div>

        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
              Username or Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              required
              className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              required
              className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center justify-end text-sm">
            <Link href="/auth/forgot" className="text-slate-600 hover:text-black font-medium underline-offset-4 hover:underline">
              Forgot Password?
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11 border-black text-black hover:bg-black/10"
              asChild
            >
              <Link href="/auth/register">(Create Account)</Link>
            </Button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  )
}
