"use client"

import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
const RECEIPT_MIN_SIZE_BYTES = 80 * 1024

const TRANSACTION_HASH_PATTERNS = [
  /^0x[a-fA-F0-9]{64}$/,
  /^[a-fA-F0-9]{64}$/,
  /^[A-Za-z0-9]{50,70}$/,
]

const EXCHANGE_OPTIONS = [
  { value: "binance", label: "Binance" },
  { value: "okx", label: "OKX" },
  { value: "bybit", label: "Bybit" },
  { value: "kucoin", label: "KuCoin" },
  { value: "coinbase", label: "Coinbase" },
  { value: "other", label: "Other" },
]

export function DepositForm({ onSuccess }: DepositFormProps) {
  const [formState, setFormState] = useState({
    amount: "",
    transactionNumber: "",
    exchangePlatform: "binance",
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

    if (file.size < RECEIPT_MIN_SIZE_BYTES) {
      setReceiptError("Receipt image is too small. Please upload the full exchange confirmation screenshot")
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
      setSubmitError("Transaction hash is required")
      return
    }

    if (!TRANSACTION_HASH_PATTERNS.some((pattern) => pattern.test(trimmedTransactionNumber))) {
      setSubmitError("Enter a valid blockchain transaction hash")
      return
    }

    if (!receiptFile) {
      setSubmitError("Upload the exchange payment receipt screenshot")
      return
    }

    setSubmitLoading(true)
    setSubmitError("")
    setSubmitSuccess("")

    try {
      const payload = new FormData()
      payload.append("amount", parsedAmount.toString())
      payload.append("transactionNumber", trimmedTransactionNumber)
      payload.append("exchangePlatform", formState.exchangePlatform)
      payload.append("receipt", receiptFile)

      const response = await fetch("/api/wallet/deposit", {
        method: "POST",
        body: payload,
      })

      const data = await response.json()

      if (!response.ok) {
        setSubmitError(data.error || "Deposit failed. Please try again.")
        return
      }

      setSubmitSuccess("Deposit request submitted successfully! Awaiting compliance review.")
      setFormState({ amount: "", transactionNumber: "", exchangePlatform: formState.exchangePlatform })
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
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-5 shadow-sm dark:from-slate-900 dark:via-slate-900/60 dark:to-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 md:max-w-md">
            <div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Deposit address</p>
              <p className="text-xs text-muted-foreground">
                Transfer only USDT to the address below. Cross-check the network before confirming on your exchange.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                readOnly
                value={
                  addressLoading
                    ? "Loading deposit address..."
                    : depositAddress || "Deposit address unavailable"
                }
                className="h-12 rounded-xl bg-white font-mono text-sm shadow-inner dark:bg-slate-950"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleCopy}
                disabled={!depositAddress || addressLoading}
                className="h-12 rounded-xl border-slate-300 text-sm font-semibold shadow-sm"
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
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Network: {depositNetwork}</p>
            )}
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• Use the exact transaction hash from Binance, OKX, or your preferred exchange.</li>
              <li>• Upload the full confirmation screenshot showing date, amount, and hash.</li>
              <li>• Deposits are reviewed by compliance before crediting.</li>
            </ul>
          </div>
          {depositAddress && (
            <div className="flex shrink-0 justify-center">
              <img
                src={qrCodeUrl}
                alt="Deposit address QR code"
                className="h-44 w-44 rounded-xl border bg-white p-2 shadow-md"
              />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deposit-amount" className="text-sm font-semibold">
                Amount (USDT)
              </Label>
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
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Exchange</Label>
              <Select
                value={formState.exchangePlatform}
                onValueChange={(value) =>
                  setFormState((previous) => ({ ...previous, exchangePlatform: value }))
                }
                disabled={addressLoading}
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select exchange" />
                </SelectTrigger>
                <SelectContent>
                  {EXCHANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction-number" className="text-sm font-semibold">
                Transaction Hash
              </Label>
              <Input
                id="transaction-number"
                type="text"
                placeholder="Paste the 64-character blockchain hash"
                value={formState.transactionNumber}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, transactionNumber: event.target.value }))
                }
                required
                disabled={addressLoading}
                className="h-12 rounded-xl font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                For Binance/OKX copy the TxID from your withdrawal details page.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="transaction-receipt" className="text-sm font-semibold">
              Upload Confirmation Screenshot
            </Label>
            <Input
              key={receiptInputKey}
              id="transaction-receipt"
              type="file"
              accept={RECEIPT_ALLOWED_TYPES.join(",")}
              onChange={handleReceiptChange}
              disabled={addressLoading}
              className="h-12 cursor-pointer rounded-xl"
            />
            {receiptError && <p className="text-xs text-destructive">{receiptError}</p>}

            {receiptFile && (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3">
                {receiptPreview ? (
                  <img
                    src={receiptPreview}
                    alt="Transaction receipt preview"
                    className="h-16 w-16 rounded-lg object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-xs">
                    Preview
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{receiptFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(receiptFile.size / 1024 / 1024).toFixed(2)} MB • {receiptFile.type}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={handleReceiptRemove}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Screenshots under 80KB are automatically rejected. Ensure the exchange name, time, and transaction hash are all visible.
            </p>
          </div>
        </div>
      </section>

      <Button
        type="submit"
        disabled={submitLoading || addressLoading || !depositAddress}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-base font-semibold shadow-lg hover:from-emerald-600 hover:to-blue-600"
      >
        {submitLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <ArrowDownLeft className="mr-2 h-4 w-4" />
            Submit Deposit for Review
          </>
        )}
      </Button>
    </form>
  )
}
