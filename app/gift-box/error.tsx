"use client"

import { useEffect } from "react"

import { logClientError } from "@/lib/logger"

interface GiftBoxErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GiftBoxError({ error, reset }: GiftBoxErrorProps) {
  useEffect(() => {
    logClientError("app/gift-box/error", "Gift Box route crashed", {
      error,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <main className="relative flex-1 overflow-y-auto">
        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
          <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 p-10 text-center text-slate-200">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-white">Gift Box is temporarily unavailable</h1>
                <p className="mt-2 text-sm text-slate-300">
                  Something unexpected happened while loading the Gift Box. Try again or contact support if it keeps happening.
                </p>
              </div>
              <p className="text-xs text-slate-400">The issue has been logged in the browser console for troubleshooting.</p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="inline-flex items-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
