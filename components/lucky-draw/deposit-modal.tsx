"use client"

import { useEffect, useState } from "react"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Copy, Check } from "lucide-react"
import type { LuckyDrawDeposit } from "@/lib/types/lucky-draw"

interface LuckyDrawDepositModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (deposit?: LuckyDrawDeposit) => void
}

const FIXED_AMOUNT = 10
const LUCKY_DRAW_WALLET = {
  network: "BEP20",
  address: "0xde7b66da140bdbe9d113966c690eeb9cff83d756",
}

export function LuckyDrawDepositModal({ open, onOpenChange, onSuccess }: LuckyDrawDepositModalProps) {
  const { toast } = useToast()
  const [transactionHash, setTransactionHash] = useState("")
  const [receiptUrl, setReceiptUrl] = useState("")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptInputKey, setReceiptInputKey] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) {
      setError(null)
      setSubmitting(false)
      setCopied(false)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (receiptPreview) {
        URL.revokeObjectURL(receiptPreview)
      }
    }
  }, [receiptPreview])

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] ?? null
    setReceiptFile(file)
    setReceiptPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return file ? URL.createObjectURL(file) : null
    })
  }

  const handleFileRemove = () => {
    setReceiptFile(null)
    setReceiptPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return null
    })
    setReceiptInputKey(Date.now())
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()

    const trimmedHash = transactionHash.trim()
    const trimmedReceiptUrl = receiptUrl.trim()

    if (!trimmedHash) {
      setError("Transaction hash is required.")
      return
    }

    if (!receiptFile && trimmedReceiptUrl.length === 0) {
      setError("A receipt upload or URL is required.")
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      let response: Response

      if (receiptFile) {
        const formData = new FormData()
        formData.append("transactionHash", trimmedHash)
        if (trimmedReceiptUrl) {
          formData.append("receiptUrl", trimmedReceiptUrl)
        }
        formData.append("receipt", receiptFile)

        response = await fetch("/api/lucky-draw/deposits", {
          method: "POST",
          body: formData,
        })
      } else {
        response = await fetch("/api/lucky-draw/deposits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionHash: trimmedHash, receiptUrl: trimmedReceiptUrl }),
        })
      }

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = payload?.error ?? "Unable to submit deposit. Please try again."
        setError(message)
        return
      }

      const deposit = (payload?.deposit ?? null) as LuckyDrawDeposit | null

      toast({ description: "Your $10 Lucky Draw deposit request was submitted." })

      setTransactionHash("")
      setReceiptUrl("")
      handleFileRemove()

      onSuccess?.(deposit ?? undefined)
      onOpenChange(false)
    } catch (submissionError) {
      console.error("Lucky draw deposit submission failed", submissionError)
      setError("Unable to submit deposit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyAddress = async () => {
    if (copied) return

    try {
      await navigator.clipboard.writeText(LUCKY_DRAW_WALLET.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (copyError) {
      console.error("Failed to copy lucky draw address", copyError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Join the Lucky Draw</DialogTitle>
          <DialogDescription>
            Submit your $10 transaction hash and receipt to enter the next Lucky Draw round.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Deposit address</p>
              <p className="text-xs text-muted-foreground">
                Send exactly $10 USDT to the verified wallet below before submitting your receipt.
              </p>
            </div>
            <Badge className="bg-primary/10 text-primary">{LUCKY_DRAW_WALLET.network}</Badge>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-background/80 p-3 font-mono text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
            <span className="truncate" title={LUCKY_DRAW_WALLET.address}>
              {LUCKY_DRAW_WALLET.address}
            </span>
            <Button type="button" variant="secondary" size="sm" className="flex items-center gap-2" onClick={handleCopyAddress}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lucky-draw-amount">Amount</Label>
            <Input id="lucky-draw-amount" readOnly value={`$${FIXED_AMOUNT.toFixed(2)}`} className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lucky-draw-hash">Transaction hash</Label>
            <Input
              id="lucky-draw-hash"
              placeholder="Paste the blockchain hash"
              value={transactionHash}
              onChange={(event) => setTransactionHash(event.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lucky-draw-receipt-url">Receipt URL (optional)</Label>
            <Input
              id="lucky-draw-receipt-url"
              placeholder="https://"
              value={receiptUrl}
              onChange={(event) => setReceiptUrl(event.target.value)}
              disabled={submitting}
              type="url"
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="lucky-draw-receipt-file">Upload receipt (optional)</Label>
              <Input
                key={receiptInputKey}
                id="lucky-draw-receipt-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                disabled={submitting}
              />
            </div>
            {receiptFile ? (
              <div className="flex items-center justify-between rounded-lg border border-dashed p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{receiptFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(receiptFile.size / 1024 / 1024).toFixed(2)} MB • {receiptFile.type || "Unknown type"}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleFileRemove}>
                  Remove
                </Button>
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit deposit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
