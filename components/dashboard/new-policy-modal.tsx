
"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, Info, X } from "lucide-react"

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

  // ✅ Har reload pe modal dubara open hoga
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
        // ✅ Centered modal, nice shadow & blur
        className="sm:max-w-xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-slate-800">
            <Info className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="flex-1 space-y-4">
            {/* Heading + Close */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <DialogTitle
                  id={headingId}
                  className="text-lg font-bold leading-tight text-foreground"
                >
                  Important Withdrawal Policy Update
                </DialogTitle>
                <div
                  aria-hidden="true"
                  className="h-1 w-28 animate-pulse rounded-full bg-gradient-to-r from-amber-500 via-red-500 to-amber-500"
                />
              </div>

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

            {/* Short description */}
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Please read the following policy update carefully. These rules will be
              effective from <span className="font-semibold text-foreground">12 AM tonight</span>.
            </DialogDescription>

            {/* Main content box */}
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                Effective from tonight after 12 AM
              </div>

              <div className="space-y-3 rounded-lg bg-background/80 p-4 shadow-sm ring-1 ring-border/70">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">From tonight after 12 AM:</span>
                </p>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>
                    <span className="font-semibold text-foreground">Only profit withdrawals</span>{" "}
                    will be allowed, with a minimum of{" "}
                    <span className="font-semibold text-foreground">30 USDT</span>.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">
                      Commission withdrawals
                    </span>{" "}
                    will also be allowed.
                  </li>
                  <li>
                    We need some time because we are going to{" "}
                    <span className="font-semibold text-foreground">
                      block the accounts of users who have created more than one account
                    </span>
                    . They have forced us to impose strict policies.
                  </li>
                </ul>
              </div>

              <div className="space-y-3 rounded-lg bg-background/80 p-4 shadow-sm ring-1 ring-border/70">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Final announcement of the new policy:
                  </span>
                </p>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>
                    From <span className="font-semibold text-foreground">12 AM</span>,{" "}
                    <span className="font-semibold text-foreground">profit withdrawals</span>{" "}
                    will start.
                  </li>
                  <li>
                    The{" "}
                    <span className="font-semibold text-foreground">
                      approval time will be 24 to 48 hours
                    </span>
                    .
                  </li>
                  <li>
                    If a withdrawal is{" "}
                    <span className="font-semibold text-foreground">rejected twice</span> and the
                    member does not resolve the stated reason, then on the{" "}
                    <span className="font-semibold text-foreground">
                      third attempt the account will be blocked
                    </span>
                    .
                  </li>
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                These measures are being taken to protect the system and ensure fair use for
                all members.
              </p>
            </div>

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-muted-foreground">
                By continuing to use the platform, you agree to follow the updated policy.
              </div>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-lg px-4"
                  aria-label="I have read the new policy"
                >
                  I Understand
                </Button>
              </DialogClose>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
