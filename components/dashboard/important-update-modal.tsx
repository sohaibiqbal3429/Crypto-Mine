"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, Info, Smartphone, X } from "lucide-react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "important-update-dismissed_app-launch-2025"
const COUNTDOWN_START = new Date(Date.UTC(2025, 10, 27, 0, 0, 0))
const LAUNCH_DATE = new Date(Date.UTC(2025, 11, 20, 0, 0, 0))

interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
}

type CountdownPhase = "pre" | "during" | "post"

const formatTimeValue = (value: number) => value.toString().padStart(2, "0")

export function ImportantUpdateModal() {
  const [open, setOpen] = useState(false)
  const [countdown, setCountdown] = useState<Countdown | null>(null)
  const [phase, setPhase] = useState<CountdownPhase>("pre")

  const headingId = useMemo(() => "mobile-app-update-heading", [])

  useEffect(() => {
    let timer: number | undefined

    const shouldShow = (() => {
      try {
        return window.localStorage.getItem(STORAGE_KEY) !== "true"
      } catch (error) {
        console.warn("Unable to access localStorage for important update modal", error)
        return true
      }
    })()

    if (shouldShow) {
      timer = window.setTimeout(() => setOpen(true), 300)
    }

    return () => {
      if (typeof timer === "number") {
        window.clearTimeout(timer)
      }
    }
  }, [])

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()

      if (now >= LAUNCH_DATE) {
        setPhase("post")
        setCountdown(null)
        return
      }

      if (now < COUNTDOWN_START) {
        setPhase("pre")
        setCountdown(null)
        return
      }

      setPhase("during")

      const diffSeconds = Math.max(
        0,
        Math.floor((LAUNCH_DATE.getTime() - now.getTime()) / 1000),
      )

      const days = Math.floor(diffSeconds / (60 * 60 * 24))
      const hours = Math.floor((diffSeconds % (60 * 60 * 24)) / (60 * 60))
      const minutes = Math.floor((diffSeconds % (60 * 60)) / 60)
      const seconds = diffSeconds % 60

      setCountdown({ days, hours, minutes, seconds })
    }

    updateCountdown()

    const interval = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(interval)
  }, [])

  const persistDismissal = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true")
    } catch (error) {
      console.warn("Unable to persist important update dismissal", error)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setOpen(false)
    persistDismissal()
  }, [persistDismissal])

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) {
          persistDismissal()
        }
      }}
    >
      <DialogContent
        aria-labelledby={headingId}
        showCloseButton={false}
        className="sm:max-w-xl top-8 left-auto right-4 translate-x-0 translate-y-0 sm:right-8 sm:top-6 border border-border/70 bg-card/95 shadow-2xl backdrop-blur"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-slate-800">
            <Info className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <DialogTitle
                  id={headingId}
                  className="text-lg font-bold leading-tight text-foreground"
                >
                  Important Update: Our Mobile App Launches on December 20, 2025
                </DialogTitle>
                <div
                  aria-hidden="true"
                  className="h-1 w-24 animate-pulse rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-sky-500"
                />
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Dismiss mobile app launch update"
                  className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full p-1"
                  onClick={handleDismiss}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </DialogClose>
            </div>

            <DialogDescription className="text-base leading-relaxed text-muted-foreground">
              Get ready. Our official mobile app is launching on December 20, 2025.
              Track the countdown below and stay tuned for more updates and new features.
            </DialogDescription>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-muted/40 p-4 sm:grid-cols-[auto,1fr] sm:items-center">
              <div className="flex flex-col gap-2 text-sm font-medium text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-slate-700" aria-hidden="true" />
                  Mobile app update
                </span>
                <span className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-slate-700" aria-hidden="true" />
                  Launches December 20, 2025
                </span>
              </div>

              <div className="rounded-lg bg-background/80 p-4 shadow-sm ring-1 ring-border/70">
                <p className="text-sm font-semibold text-muted-foreground">
                  Time remaining:
                </p>
                {phase === "during" && countdown ? (
                  <p
                    className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {`${countdown.days.toString().padStart(2, "0")} days : ${formatTimeValue(countdown.hours)} hours : ${formatTimeValue(countdown.minutes)} minutes : ${formatTimeValue(countdown.seconds)} seconds`}
                  </p>
                ) : phase === "post" ? (
                  <p className="mt-2 text-lg font-semibold text-emerald-600">
                    The app is now live.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Countdown begins on November 27, 2025.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                We&apos;ll keep you posted with reminders as launch day approaches.
              </div>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-lg"
                  aria-label="Close mobile app launch update"
                  onClick={handleDismiss}
                >
                  Close
                </Button>
              </DialogClose>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
