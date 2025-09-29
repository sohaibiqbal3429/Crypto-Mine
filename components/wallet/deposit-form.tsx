"use client"

import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowDownLeft, CheckCircle, Copy, Loader2, RefreshCcw, XCircle } from "lucide-react"

interface DepositFormProps {
  onSuccess?: () => void
}

interface DepositAddressResponse {
  address: string
  network?: string
}

const RECEIPT_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]
const RECEIPT_MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export function DepositForm({ onSuccess }: DepositFormProps) {
  const [formState, setFormState] = useState({
    amount: "",
    transactionNumber: "",
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState("")
  const [receiptError, setReceiptError] = useState("")
  const [receiptInputKey, setReceiptInputKey] = useState(() => Date.now())

  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState("")

  const [depositAddress, setDepositAddress] = useState("")
  const [depositNetwork, setDepositNetwork] = useState("")
  const [addressLoading, setAddressLoading] = useState(true)
  const [addressError, setAddressError] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchDepositAddress()
  }, [])

  useEffect(() => {
    return () => {
      if (receiptPreview) {
        URL.revokeObjectURL(receiptPreview)
      }
    }
  }, [receiptPreview])

  const fetchDepositAddress = async () => {
    try {
      setAddressLoading(true)
      setAddressError("")

      const response = await fetch("/api/wallet/deposit-address")
      if (!response.ok) {
        throw new Error("Failed to load deposit address")
      }

      const data: DepositAddressResponse = await response.json()
      setDepositAddress(data.address)
      setDepositNetwork(data.network || "")
    } catch (error) {
      console.error("Failed to fetch deposit address", error)
      setAddressError("Unable to load the deposit address. Please try again in a moment.")
      setDepositAddress("")
      setDepositNetwork("")
    } finally {
      setAddressLoading(false)
    }
  }

  const qrCodeUrl = useMemo(() => {
    if (!depositAddress) {
      return ""
    }

    return `https://quickchart.io/qr?size=220&text=${encodeURIComponent(depositAddress)}`
  }, [depositAddress])

  const handleCopy = async () => {
    if (!depositAddress || copied) {
      return
    }

    try {
      await navigator.clipboard.writeText(depositAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy deposit address", error)
    }
  }

  const handleReceiptChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] ?? null

    setReceiptError("")

    if (!file) {
      setReceiptFile(null)
      setReceiptPreview((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous)
        }
        return ""
      })
      setReceiptInputKey(Date.now())
      return
    }

    if (!RECEIPT_ALLOWED_TYPES.includes(file.type)) {
      setReceiptError("Receipt must be an image (PNG, JPG, JPEG, WEBP, or GIF)")
      event.target.value = ""
      return
    }

    if (file.size > RECEIPT_MAX_SIZE_BYTES) {
      setReceiptError("Receipt image must be smaller than 5MB")
      event.target.value = ""
      return
    }

    setReceiptFile(file)
    setReceiptPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return URL.createObjectURL(file)
    })
  }

  const handleReceiptRemove = () => {
    setReceiptError("")
    setReceiptFile(null)
    setReceiptPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return ""
    })
    setReceiptInputKey(Date.now())
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()

    if (!depositAddress) {
      setSubmitError("Deposit address unavailable. Please refresh and try again.")
      return
    }

    const parsedAmount = Number.parseFloat(formState.amount)
    if (Number.isNaN(parsedAmount)) {
      setSubmitError("Enter a valid deposit amount")
      return
    }

    const trimmedTransactionNumber = formState.transactionNumber.trim()
    if (!trimmedTransactionNumber) {
      setSubmitError("Transaction number is required")
      return
    }

    setSubmitLoading(true)
    setSubmitError("")
    setSubmitSuccess("")

    try {
      const payload = new FormData()
      payload.append("amount", parsedAmount.toString())
      payload.append("transactionNumber", trimmedTransactionNumber)

      if (receiptFile) {
        payload.append("receipt", receiptFile)
      }

      const response = await fetch("/api/wallet/deposit", {
        method: "POST",
        body: payload,
      })

      const data = await response.json()

      if (!response.ok) {
        setSubmitError(data.error || "Deposit failed. Please try again.")
        return
      }

      setSubmitSuccess("Deposit request submitted successfully! Awaiting admin approval.")
      setFormState({ amount: "", transactionNumber: "" })
      handleReceiptRemove()
      onSuccess?.()
    } catch (error) {
      console.error("Deposit submission failed", error)
      setSubmitError("Network error. Please try again.")
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {addressError && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{addressError}</span>
            <Button type="button" variant="secondary" size="sm" onClick={fetchDepositAddress}>
              <RefreshCcw className="mr-1 h-3 w-3" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {submitSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{submitSuccess}</AlertDescription>
          </div>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>Send USDT to this address</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            readOnly
            value={
              addressLoading ? "Loading deposit address..." : depositAddress || "Deposit address unavailable"
            }
            className="font-mono"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleCopy}
            disabled={!depositAddress || addressLoading}
            className="shrink-0"
          >
            {copied ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </>
            )}
          </Button>
        </div>
        {depositNetwork && (
          <p className="text-xs text-muted-foreground">Network: {depositNetwork}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Only send USDT to this address. After you submit the transaction number and receipt, our team will verify your payment.
        </p>
      </div>

      {depositAddress && (
        <div className="flex justify-center">
          <img
            src={qrCodeUrl}
            alt="Deposit address QR code"
            className="h-44 w-44 rounded-md border bg-white p-2"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="deposit-amount">Amount (USDT)</Label>
        <Input
          id="deposit-amount"
          type="number"
          min="30"
          step="0.01"
          placeholder="Enter amount (min $30)"
          value={formState.amount}
          onChange={(event) =>
            setFormState((previous) => ({ ...previous, amount: event.target.value }))
          }
          required
          disabled={addressLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="transaction-number">Transaction Number</Label>
        <Input
          id="transaction-number"
          type="text"
          placeholder="Please enter your transaction number"
          value={formState.transactionNumber}
          onChange={(event) =>
            setFormState((previous) => ({ ...previous, transactionNumber: event.target.value }))
          }
          required
          disabled={addressLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="transaction-receipt">Recharge Screenshot Upload</Label>
        <Input
          key={receiptInputKey}
          id="transaction-receipt"
          type="file"
          accept={RECEIPT_ALLOWED_TYPES.join(",")}
          onChange={handleReceiptChange}
          disabled={addressLoading}
        />
        {receiptError && <p className="text-xs text-destructive">{receiptError}</p>}

        {receiptFile && (
          <div className="flex items-center gap-3 rounded-md border p-3">
            {receiptPreview ? (
              <img
                src={receiptPreview}
                alt="Transaction receipt preview"
                className="h-16 w-16 rounded object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-xs">
                Preview
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{receiptFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(receiptFile.size / 1024 / 1024).toFixed(2)} MB - {receiptFile.type}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={handleReceiptRemove}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Upload a clear screenshot of your payment receipt (PNG, JPG, JPEG, WEBP, or GIF, max 5MB).
        </p>
      </div>

      <Button type="submit" disabled={submitLoading || addressLoading || !depositAddress} className="w-full">
        {submitLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <ArrowDownLeft className="mr-2 h-4 w-4" />
            OK to Recharge
          </>
        )}
      </Button>
    </form>
  )
}
