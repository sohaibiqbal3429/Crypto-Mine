"use client"

import { useCallback, useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "important-update-dismissed"

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

    window.requestAnimationFrame(() => {
      const luckyDrawSection = document.getElementById("lucky-draw")
      luckyDrawSection?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [persistDismissal])

  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value)
      if (!value) {
        persistDismissal()
      }
    }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md overflow-hidden rounded-xl border-0 p-0 shadow-2xl"
      >
        <div className="bg-[#773004] px-6 py-4 text-white">
          <DialogTitle className="text-center text-lg font-semibold uppercase tracking-wide">
            Important Update
          </DialogTitle>
        </div>
        <div className="space-y-4 px-6 py-6 text-sm leading-6 text-muted-foreground">
          <DialogDescription asChild>
            <div className="space-y-3 text-left">
              <p className="text-foreground">
                Dear Investor, Please accept our sincere apologies for the delay and any inconvenience this has caused.
              </p>
              <p>
                We are actively working to resolve this presented issues
               
              </p>
              <p>We appreciate your patience. Thank you for your understanding.</p>
            </div>
          </DialogDescription>
        </div>
        <div className="bg-muted/40 px-6 py-4">
          <Button className="w-full" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
