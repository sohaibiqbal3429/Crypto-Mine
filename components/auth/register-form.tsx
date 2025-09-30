"use client"

import Link from "next/link"
import { useFormState, useFormStatus } from "react-dom"
import { Loader2, UserPlus } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerAction, type AuthFormState } from "@/app/auth/actions"

const initialState: AuthFormState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="h-11 flex-1 sm:flex-none bg-black hover:bg-black/90" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Registering...
        </>
      ) : (
        "Register"
      )}
    </Button>
  )
}

export function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, initialState)

  return (
    <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
      <div className="bg-black text-white text-center py-4">
        <h1 className="text-lg font-semibold tracking-wide">Referral Signup System</h1>
      </div>

      <div className="px-8 py-6 space-y-6">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full border border-slate-300 flex items-center justify-center text-slate-600">
            <UserPlus className="w-8 h-8" />
          </div>
        </div>

        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Enter name"
                required
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter email"
                required
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter password"
                minLength={6}
                required
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">
                Re-enter Password
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                minLength={6}
                required
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referralCode" className="text-sm font-semibold text-slate-700">
              Referral Code
            </Label>
            <Input
              id="referralCode"
              name="referralCode"
              placeholder="Referral code"
              required
              className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              className="sm:w-auto h-11 border-black text-black hover:bg-black/10"
              asChild
            >
              <Link href="/auth/forgot">Forgot Password?</Link>
            </Button>

            <SubmitButton />
          </div>
        </form>

        <p className="text-center text-sm text-slate-600">
          Already have an account? <Link href="/auth/login" className="font-semibold text-black hover:underline">Login instead</Link>
        </p>
      </div>
    </div>
  )
}
