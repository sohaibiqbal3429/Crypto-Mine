"use client"

import { useEffect, useState } from "react"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import type { LuckyDrawDeposit } from "@/lib/types/lucky-draw"

interface LuckyDrawDepositModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (deposit?: LuckyDrawDeposit) => void
}

const FIXED_AMOUNT = 10

export function LuckyDrawDepositModal({ open, onOpenChange, onSuccess }: LuckyDrawDepositModalProps) {
  const { toast } = useToast()
  const [transactionHash, setTransactionHash] = useState("")
  const [receiptUrl, setReceiptUrl] = useState("")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptInputKey, setReceiptInputKey] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setError(null)
      setSubmitting(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Join the Lucky Draw</DialogTitle>
          <DialogDescription>
            Submit your $10 transaction hash and receipt to enter the next Lucky Draw round.
          </DialogDescription>
        </DialogHeader>

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
