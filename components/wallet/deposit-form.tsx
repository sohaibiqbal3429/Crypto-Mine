"use client"

import { useEffect, useMemo, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"

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
import { submitDepositAction, type DepositFormState } from "@/app/wallet/actions"
import { ArrowDownLeft, CheckCircle, Copy, Loader2, XCircle } from "lucide-react"

interface DepositOption {
  id: string
  label: string
  network: string
  address: string
}

interface DepositFormProps {
  options: DepositOption[]
  minDeposit: number
  onSuccess?: () => void
}

const initialState: DepositFormState = { error: null, success: null }

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-base font-semibold shadow-lg hover:from-emerald-600 hover:to-blue-600"
    >
      {pending ? (
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
  )
}

export function DepositForm({ options, minDeposit, onSuccess }: DepositFormProps) {
  const [state, formAction] = useFormState(submitDepositAction, initialState)

  const [selectedOptionId, setSelectedOptionId] = useState(() => options[0]?.id ?? "")
  const selectedOption = useMemo(() => options.find((option) => option.id === selectedOptionId), [options, selectedOptionId])
  const formattedMinDeposit = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(minDeposit),
    [minDeposit],
  )

  useEffect(() => {
    if (!selectedOption && options.length > 0) {
      setSelectedOptionId(options[0].id)
    }
  }, [selectedOption, options])

  const [formState, setFormState] = useState({
    amount: "",
    transactionNumber: "",
    exchangePlatform: "binance",
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState("")
  const [receiptInputKey, setReceiptInputKey] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (state?.success) {
      setFormState({ amount: "", transactionNumber: "", exchangePlatform: "binance" })
      handleReceiptRemove()
      onSuccess?.()
    }
  }, [state?.success, onSuccess])

  useEffect(() => {
    return () => {
      if (receiptPreview) {
        URL.revokeObjectURL(receiptPreview)
      }
    }
  }, [receiptPreview])

  const selectedAddress = selectedOption?.address ?? ""
  const qrCodeUrl = useMemo(() => {
    if (!selectedAddress) return ""
    return `https://quickchart.io/qr?size=220&text=${encodeURIComponent(selectedAddress)}`
  }, [selectedAddress])

  const handleCopy = async () => {
    if (!selectedAddress || copied) return

    try {
      await navigator.clipboard.writeText(selectedAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy deposit address", error)
    }
  }

  // ✅ Allow all image types
  const handleReceiptChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] ?? null

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

    setReceiptFile(file)
    setReceiptPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return URL.createObjectURL(file)
    })
  }

  const handleReceiptRemove = () => {
    setReceiptFile(null)
    setReceiptPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return ""
    })
    setReceiptInputKey(Date.now())
  }

  if (!selectedOption || !selectedAddress) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No deposit wallets are configured. Please contact support.</AlertDescription>
      </Alert>
    )
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-6">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.success && (
        <Alert className="border border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{state.success}</AlertDescription>
          </div>
        </Alert>
      )}

      {/* Network Selection */}
      <section className="rounded-3xl border border-border/80 bg-card/90 p-5 shadow-lg shadow-primary/10 transition-colors">
        <div className="space-y-4">
          <Label className="text-sm font-semibold text-foreground/90">
            Select Network
          </Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {options.map((option) => {
              const isSelected = option.id === selectedOption.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedOptionId(option.id)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/30"
                      : "border-border/70 bg-background/70 hover:border-primary/60 hover:shadow"
                  }`}
                >
                  <p className="text-xs uppercase text-muted-foreground">{option.network}</p>
                  <p className="text-sm font-semibold text-foreground">{option.label}</p>
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                    {option.address}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 md:max-w-md">
            <p className="text-sm font-semibold text-muted-foreground">Deposit address</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                readOnly
                value={selectedAddress}
                className="h-12 rounded-xl bg-background/80 font-mono text-sm shadow-inner dark:bg-input/40"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleCopy}
                className="h-12 rounded-xl border border-border/60 text-sm font-semibold shadow-sm"
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
          </div>
          {selectedAddress && (
            <div className="flex shrink-0 justify-center">
              <img
                src={qrCodeUrl}
                alt="Deposit address QR code"
                className="h-44 w-44 rounded-xl border border-border/60 bg-card p-2 shadow-md"
              />
            </div>
          )}
        </div>
      </section>

      {/* Deposit Form */}
      <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-lg shadow-primary/5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deposit-amount" className="text-sm font-semibold text-foreground/90">
                Amount (USDT)
              </Label>
              <Input
                id="deposit-amount"
                name="amount"
                type="number"
                min={minDeposit}
                step="0.01"
                placeholder={`Enter amount (minimum $${formattedMinDeposit})`}
                value={formState.amount}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, amount: event.target.value }))
                }
                onInput={(event) => event.currentTarget.setCustomValidity("")}
                onInvalid={(event) => {
                  const input = event.currentTarget
                  if (input.validity.valueMissing) {
                    input.setCustomValidity("")
                    return
                  }
                  if (input.validity.rangeUnderflow) {
                    input.setCustomValidity(`Amount must be at least $${formattedMinDeposit}.`)
                    return
                  }

                  input.setCustomValidity("")
                }}
                required
                className="h-12 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                {`Minimum deposit is $${formattedMinDeposit}. You can deposit more if you wish.`}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground/90">Exchange</Label>
              <Select
                value={formState.exchangePlatform}
                onValueChange={(value) =>
                  setFormState((previous) => ({ ...previous, exchangePlatform: value }))
                }
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select exchange" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="binance">Binance</SelectItem>
                  <SelectItem value="okx">OKX</SelectItem>
                  <SelectItem value="bybit">Bybit</SelectItem>
                  <SelectItem value="kucoin">KuCoin</SelectItem>
                  <SelectItem value="coinbase">Coinbase</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction-number" className="text-sm font-semibold text-foreground/90">
                Transaction Hash
              </Label>
              <Input
                id="transaction-number"
                name="transactionNumber"
                type="text"
                placeholder="Paste the 64-character blockchain hash"
                value={formState.transactionNumber}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, transactionNumber: event.target.value }))
                }
                required
                className="h-12 rounded-xl font-mono text-sm"
              />
            </div>
          </div>

          {/* Upload Section */}
          <div className="space-y-3">
            <Label htmlFor="transaction-receipt" className="text-sm font-semibold text-foreground/90">
              Upload Confirmation Screenshot
            </Label>
            <Input
              key={receiptInputKey}
              id="transaction-receipt"
              name="receipt"
              type="file"
              accept="image/*"   // ✅ now allows all image formats
              onChange={handleReceiptChange}
              className="h-12 cursor-pointer rounded-xl"
            />

            {receiptFile && (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/70 bg-background/80 p-3">
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Transaction receipt preview" className="h-16 w-16 rounded-lg object-cover shadow-sm" />
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
          </div>
        </div>
      </section>

      <input type="hidden" name="network" value={selectedOption.id} />
      <input type="hidden" name="exchangePlatform" value={formState.exchangePlatform} />

      <SubmitButton />
    </form>
  )
}
