"use client"

import { useEffect, useMemo, useState } from "react"
import { Info, X } from "lucide-react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function NewPolicyModal() {
  const [open, setOpen] = useState(false)
  const headingId = useMemo(() => "new-policy-modal-heading", [])

  // ✅ Har reload pe modal open hoga
  useEffect(() => {
    let timer: number | undefined

    timer = window.setTimeout(() => setOpen(true), 300)

    return () => {
      if (typeof timer === "number") {
        window.clearTimeout(timer)
      }
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-labelledby={headingId}
        showCloseButton={false}
        // ✅ Centered modal, clean look
        className="sm:max-w-xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-slate-800">
            <Info className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="flex-1 space-y-4">
            {/* Heading + Close */}
            <div className="flex items-start justify-between gap-4">
              <DialogTitle
                id={headingId}
                className="text-lg font-bold leading-tight text-foreground"
              >
                Withdrawal Policy Update
              </DialogTitle>

              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Close policy update"
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </DialogClose>
            </div>

            {/* ✅ Sirf yeh content */}
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              only profit withdrawals will be allowed, with a minimum of 30 USDT. Commission
              withdrawals will also be allowed and the approval time will be 24 to 48 hours. If a
              withdrawal is rejected twice and the member does not resolve the stated reason, then
              on the third attempt the account will be blocked.
            </DialogDescription>

            <div className="flex justify-end">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-lg px-4"
                  aria-label="I understand the withdrawal policy"
                >
                  OK
                </Button>
              </DialogClose>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
