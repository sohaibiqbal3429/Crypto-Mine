"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { differenceInSeconds, format } from "date-fns"
import { CalendarDays, Gift, History, Timer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"

const DEPOSIT_ADDRESS = "0xde7b66da140bdbe9d113966c690eeb9cff83d756"
const REQUIRED_AMOUNT = 10

export type DepositStatus = "PENDING" | "ACCEPTED" | "REJECTED"

interface LuckyDrawDeposit {
  id: string
  txHash: string
  receiptReference: string
  submittedAt: string
  status: DepositStatus
}

interface LuckyDrawRound {
  id: string
  startAtUtc: string
  endAtUtc: string
  prizePoolUsd: number
  lastWinner?: {
    name: string
    announcedAt: string
  } | null
}

interface LuckyDrawCardProps {
  round?: LuckyDrawRound
  deposits?: LuckyDrawDeposit[]
  onDepositSubmit?: (deposit: LuckyDrawDeposit) => void
}

export function LuckyDrawCard({ round, deposits: depositsProp, onDepositSubmit }: LuckyDrawCardProps) {
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const [txHash, setTxHash] = useState("")
  const [receiptUrl, setReceiptUrl] = useState("")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [confirmedAmount, setConfirmedAmount] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [localRound] = useState<LuckyDrawRound>(
    round ?? {
      id: "demo-round",
      startAtUtc: new Date().toISOString(),
      endAtUtc: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      prizePoolUsd: 30,
      lastWinner: {
        name: "Wallet Ninja",
        announcedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  )

  const [localDeposits, setLocalDeposits] = useState<LuckyDrawDeposit[]>(
    depositsProp ?? [
      {
        id: "demo-1",
        txHash: "0x1234...abcd",
        receiptReference: "https://bscscan.com/tx/0x1234",
        submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: "ACCEPTED",
      },
      {
        id: "demo-2",
        txHash: "0x9876...wxyz",
        receiptReference: "Receipt-upload.pdf",
        submittedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        status: "PENDING",
      },
    ],
  )

  const deposits = depositsProp ?? localDeposits

  const acceptedEntries = useMemo(() => deposits.filter((deposit) => deposit.status === "ACCEPTED").length, [deposits])

  const nextDrawDate = useMemo(() => new Date((round ?? localRound).endAtUtc), [round, localRound])
  const roundStartDate = useMemo(() => new Date((round ?? localRound).startAtUtc), [round, localRound])

  const [countdown, setCountdown] = useState<string>(() => formatRemaining(nextDrawDate))

  useEffect(() => {
    setCountdown(formatRemaining(nextDrawDate))
    const interval = setInterval(() => {
      setCountdown(formatRemaining(nextDrawDate))
    }, 1000)

    return () => clearInterval(interval)
  }, [nextDrawDate])

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(DEPOSIT_ADDRESS)
      toast({ description: "Deposit address copied to clipboard." })
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", description: "Unable to copy the address. Please copy it manually." })
    }
  }, [toast])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!txHash.trim()) {
        toast({ variant: "destructive", description: "Transaction hash is required." })
        return
      }

      if (!receiptUrl.trim() && !receiptFile) {
        toast({ variant: "destructive", description: "Provide a receipt URL or upload the transaction receipt." })
        return
      }

      if (!confirmedAmount) {
        toast({ variant: "destructive", description: "Please confirm that you deposited exactly $10.00." })
        return
      }

      setSubmitting(true)

      const receiptReference = receiptUrl.trim() || receiptFile?.name || "Receipt uploaded"

      const newDeposit: LuckyDrawDeposit = {
        id: crypto.randomUUID(),
        txHash: txHash.trim(),
        receiptReference,
        submittedAt: new Date().toISOString(),
        status: "PENDING",
      }

      if (onDepositSubmit) {
        onDepositSubmit(newDeposit)
      } else {
        setLocalDeposits((prev) => [newDeposit, ...prev])
      }

      toast({ description: "Review submitted — awaiting admin confirmation." })

      setTxHash("")
      setReceiptUrl("")
      setReceiptFile(null)
      setConfirmedAmount(false)
      setIsDialogOpen(false)
      setSubmitting(false)
    },
    [confirmedAmount, onDepositSubmit, receiptFile, receiptUrl, toast, txHash],
  )

  const renderStatusBadge = (status: DepositStatus) => {
    switch (status) {
      case "ACCEPTED":
        return <Badge className="bg-emerald-500/15 text-emerald-500">Accepted</Badge>
      case "REJECTED":
        return <Badge className="bg-rose-500/15 text-rose-500">Rejected</Badge>
      default:
        return <Badge className="bg-amber-500/15 text-amber-500">Pending Review</Badge>
    }
  }

  const latestWinner = (round ?? localRound).lastWinner

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-purple-500/10 shadow-lg backdrop-blur">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.1),_transparent_60%)]" aria-hidden />
      <CardHeader className="relative z-10 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">BLIND BOX LUCKY DRAW</CardTitle>
            <p className="text-sm text-muted-foreground">Win exciting prizes every 3 days.</p>
          </div>
          <Gift className="h-10 w-10 text-amber-500" />
        </div>
        <div className="rounded-xl bg-white/40 p-4 shadow-inner">
            <p className="text-sm font-medium text-foreground">
              Pay <span className="font-semibold text-amber-600">${REQUIRED_AMOUNT.toFixed(2)}</span> to join the game and the lucky draw to win
              <span className="font-semibold"> ${(round ?? localRound).prizePoolUsd.toFixed(2)}</span>.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Have a transaction recorded for $10? Submit quickly to participate.
          </p>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <SummaryTile
            icon={<Timer className="h-5 w-5" />}
            label="Countdown"
            value={countdown}
            helper={`Next draw: ${format(nextDrawDate, "MMM d, yyyy • HH:mm:ss 'UTC'")}`}
          />
          <SummaryTile
            icon={<History className="h-5 w-5" />}
            label="Total Entries"
            value={`${acceptedEntries} participant${acceptedEntries === 1 ? "" : "s"}`}
            helper="Automatically counts accepted deposits"
          />
          <SummaryTile
            icon={<CalendarDays className="h-5 w-5" />}
            label="Round Window"
            value={`${format(roundStartDate, "MMM d, HH:mm 'UTC'")} → ${format(nextDrawDate, "MMM d, HH:mm 'UTC'")}`}
            helper="72-hour cadence"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-emerald-500/15 text-emerald-600">Prize Pool ${(round ?? localRound).prizePoolUsd.toFixed(2)}</Badge>
          <Badge className="bg-blue-500/10 text-blue-600">Join with a $10 BEP20 deposit</Badge>
          <span className="text-sm text-muted-foreground">No internal credits allowed.</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => setIsDialogOpen(true)}>
            Play Now / Buy for ${REQUIRED_AMOUNT.toFixed(2)}
          </Button>
          <Button variant="outline" className="backdrop-blur" size="lg">
            View Leaderboard
          </Button>
          <div className="text-sm text-muted-foreground">
            3 have participated — submit your $10.00 today to participate.
          </div>
        </div>

        <div className="rounded-xl border border-white/40 bg-white/50 p-4 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Last winner</p>
            <Badge variant="outline" className="border-emerald-400/50 text-emerald-600">
              Credited automatically
            </Badge>
          </div>
          <p className="mt-2 text-sm text-foreground">
            {latestWinner ? `${latestWinner.name} — announced ${format(new Date(latestWinner.announcedAt), "MMM d, yyyy")}` : "Winner will appear here once announced."}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">Your deposit reviews</h3>
            <span className="text-xs text-muted-foreground">Status updates appear in real-time</span>
          </div>
          <div className="space-y-2">
            {deposits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deposits submitted yet. Submit your $10 deposit to join this round.</p>
            ) : (
              deposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/50 bg-white/60 p-3 text-sm shadow-sm"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{deposit.txHash}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {format(new Date(deposit.submittedAt), "MMM d, yyyy • HH:mm 'UTC'")}
                    </p>
                    <p className="text-xs text-blue-600">{deposit.receiptReference}</p>
                  </div>
                  {renderStatusBadge(deposit.status)}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Deposit $10 via BEP20</DialogTitle>
            <DialogDescription>
              Deposit $10 via BNB Smart Chain (BEP20) to join the current blind box round. Use Binance or any trusted crypto
              wallet. Once accepted, you will be entered automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium text-foreground">Network: BNB Smart Chain (BEP20)</p>
              <div className="mt-3 space-y-2">
                <Label htmlFor="deposit-address" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Deposit address
                </Label>
                <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                  <Input id="deposit-address" value={DEPOSIT_ADDRESS} readOnly className="border-0 p-0 focus-visible:ring-0" />
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyAddress}>
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            <form id="deposit-form" className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="tx-hash">Transaction hash</Label>
                <Input
                  id="tx-hash"
                  placeholder="Paste your BEP20 transaction hash"
                  value={txHash}
                  onChange={(event) => setTxHash(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt-url">Transaction receipt URL</Label>
                <Input
                  id="receipt-url"
                  type="url"
                  placeholder="https://bscscan.com/tx/…"
                  value={receiptUrl}
                  onChange={(event) => setReceiptUrl(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Provide a BscScan link or upload your payment receipt below.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt-file">Upload transaction receipt</Label>
                <Input
                  id="receipt-file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                />
                {receiptFile ? <p className="text-xs text-muted-foreground">Selected: {receiptFile.name}</p> : null}
              </div>

              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <Checkbox id="confirm-amount" checked={confirmedAmount} onCheckedChange={(value) => setConfirmedAmount(Boolean(value))} />
                <Label htmlFor="confirm-amount" className="text-sm text-foreground">
                  I confirm I have deposited exactly $10.00 via BEP20 and understand admin approval is required before my entry is
                  counted.
                </Label>
              </div>
            </form>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="deposit-form" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Deposit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SummaryTile({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-xl border border-white/40 bg-white/60 p-4 shadow-sm">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="rounded-lg bg-white/70 p-2 text-amber-500">{icon}</span>
        <span className="font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

function formatRemaining(nextDrawDate: Date) {
  const now = new Date()
  const totalSeconds = Math.max(0, differenceInSeconds(nextDrawDate, now))

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const formatted = [hours, minutes, seconds].map((part) => part.toString().padStart(2, "0")).join(":")

  return totalSeconds === 0 ? "Drawing now" : formatted
}
