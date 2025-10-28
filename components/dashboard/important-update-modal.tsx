"use client"

import { useCallback, useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "important-update-dismissed_v2" // bump to re-show after shipping
const TARGET_ID = "lucky-draw"

export function ImportantUpdateModal() {
  const [open, setOpen] = useState(false)

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

    // Smooth-scroll to Lucky Draw and then move focus for accessibility
    window.requestAnimationFrame(() => {
      const luckyDrawSection = document.getElementById(TARGET_ID)
      luckyDrawSection?.scrollIntoView({ behavior: "smooth", block: "start" })
      setTimeout(() => luckyDrawSection?.focus?.({ preventScroll: true }), 600)
    })
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
        showCloseButton={false}
        className="sm:max-w-md overflow-hidden rounded-2xl border-0 p-0 shadow-2xl"
      >
        {/* Header — warm amber gradient + bold title */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-500 px-6 py-5 text-white">
          <DialogTitle className="text-center text-xl font-extrabold uppercase tracking-widest drop-shadow-sm">
            10 Dollar Game
          </DialogTitle>
          <p className="mt-1 text-center text-xs font-medium tracking-wide opacity-90">
            Boost mining power & win rewards
          </p>
        </div>

        {/* Body — clearer hierarchy + emphasized figures */}
        <div className="space-y-4 px-6 py-6 text-sm leading-7">
          <DialogDescription asChild>
            <div className="space-y-3 text-left">
              <p className="text-foreground font-semibold">
                We are excited to introduce the <span className="font-extrabold">“10 Dollar Game”</span> — a fun and
                engaging way to boost your mining power!
              </p>
              <p className="text-muted-foreground">
                For just <span className="font-bold text-amber-700">$10</span>, you can participate and stand a chance
                to win <span className="font-bold text-amber-700">$30</span>. Don’t miss this opportunity to enhance
                your mining experience.
              </p>
            </div>
          </DialogDescription>
        </div>

        {/* Footer — primary action styled to match header */}
        <div className="bg-muted/40 px-6 py-4">
          <Button
            className="w-full rounded-xl px-4 py-2 text-base font-bold shadow-md transition bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500"
            onClick={handleDismiss}
          >
            Buy Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
