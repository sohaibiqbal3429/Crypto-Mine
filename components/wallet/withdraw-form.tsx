"use client"

import { useEffect, useMemo, useState } from "react"
import { useFormState, useFormStatus } from "react-dom"

import { submitWithdrawAction, type WithdrawFormState } from "@/app/wallet/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowUpRight, CheckCircle, Loader2 } from "lucide-react"

interface WalletAddressOption {
  id: string
  label: string
  chain: string
  address: string
  verified: boolean
}

interface WithdrawFormProps {
  minWithdraw: number
  withdrawableBalance: number
  pendingWithdraw: number
  walletBalance: number
  earningsBalance: number
}

const initialState: WithdrawFormState = { error: null, success: null }

type WithdrawSource = "main" | "earnings"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-base font-semibold shadow-lg hover:from-blue-600 hover:to-purple-600"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Submitting...
        </>
      ) : (
        <>
          <ArrowUpRight className="mr-2 h-4 w-4" />
          Submit Withdrawal Request
        </>
      )}
    </Button>
  )
}

export function WithdrawForm({
  minWithdraw,
  withdrawableBalance,
  pendingWithdraw,
  walletBalance,
  earningsBalance,
}: WithdrawFormProps) {
  const [state, formAction] = useFormState(submitWithdrawAction, initialState)

  const [amount, setAmount] = useState("")
  const [manualAddress, setManualAddress] = useState("")
  const [addressMode, setAddressMode] = useState<"saved" | "manual">("manual")
  const [withdrawSource, setWithdrawSource] = useState<WithdrawSource>("main")
  const [addresses, setAddresses] = useState<WalletAddressOption[]>([])
  const [addressesLoaded, setAddressesLoaded] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState("")
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true)
  const [addressError, setAddressError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadAddresses() {
      setIsLoadingAddresses(true)
      try {
        const response = await fetch("/api/e-wallet/addresses", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })

        const data = await response.json().catch(() => null)

        if (!active) return

        if (!response.ok) {
          setAddressError(data?.error ?? "Unable to load saved addresses.")
          setAddresses([])
        } else {
          const loadedAddresses = Array.isArray(data?.addresses)
            ? (data.addresses as any[]).map((item) => ({
                id: String(item._id ?? item.id ?? ""),
                label: String(item.label ?? "Unnamed"),
                chain: String(item.chain ?? ""),
                address: String(item.address ?? ""),
                verified: Boolean(item.verified ?? false),
              }))
            : []

          setAddresses(loadedAddresses.filter((address) => address.address.length > 0))
          setAddressError(null)
        }
      } catch (error) {
        console.error("Failed to fetch saved addresses", error)
        if (!active) return
        setAddressError("Unable to load saved addresses.")
        setAddresses([])
      } finally {
        if (active) {
          setIsLoadingAddresses(false)
          setAddressesLoaded(true)
        }
      }
    }

    loadAddresses()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (addresses.length > 0) {
      setSelectedAddressId((previous) => previous || addresses[0].id)
    } else {
      setSelectedAddressId("")
    }
  }, [addresses])

  useEffect(() => {
    if (!addressesLoaded) {
      return
    }

    if (addresses.length === 0) {
      setAddressMode("manual")
      return
    }

    setAddressMode((previous) => {
      if (previous === "manual" && manualAddress.length === 0) {
        return "saved"
      }
      return previous
    })
  }, [addresses, addressesLoaded, manualAddress])

  useEffect(() => {
    if (state?.success) {
      setAmount("")
      setManualAddress("")
    }
  }, [state?.success])

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  )

  const parsedAmount = useMemo(() => Number.parseFloat(amount) || 0, [amount])
  const selectedBalance = useMemo(
    () =>
      withdrawSource === "earnings"
        ? Math.min(earningsBalance, withdrawableBalance)
        : withdrawableBalance,
    [earningsBalance, withdrawSource, withdrawableBalance],
  )
  const exceedsSelectedBalance = parsedAmount > 0 && parsedAmount > selectedBalance

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="source" value={withdrawSource} />
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.success && (
        <Alert className="border-green-200 bg-green-50">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{state.success}</AlertDescription>
          </div>
        </Alert>
      )}

      <div className="rounded-2xl border border-slate-200 bg-muted/20 p-4 text-sm text-muted-foreground dark:border-slate-700 dark:bg-slate-900/40 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-foreground">
          <span>
            Withdrawable now: <strong>${withdrawableBalance.toFixed(2)}</strong>
          </span>
          <span>
            Pending approval: <strong>${pendingWithdraw.toFixed(2)}</strong>
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Wallet balance: <strong className="text-foreground">${walletBalance.toFixed(2)}</strong>
          </span>
        </div>
        <div className="flex flex-col gap-1 text-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Earnings balance: <strong>${earningsBalance.toFixed(2)}</strong>
          </span>
          <span className="text-xs text-muted-foreground">
            Selecting a source will cap the withdrawal to that balance.
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Minimum withdrawal: ${minWithdraw.toFixed(2)} USDT. Any balance above the minimum is ready for immediate
          withdrawal.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Withdraw from</Label>
        <RadioGroup
          className="grid gap-3 sm:grid-cols-2"
          name="source"
          value={withdrawSource}
          onValueChange={(value) => setWithdrawSource(value as WithdrawSource)}
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white/60 p-3 text-sm shadow-sm transition hover:border-primary/60 dark:border-slate-700 dark:bg-slate-900/60">
            <RadioGroupItem value="main" />
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground">Main Balance</div>
              <p className="text-xs text-muted-foreground">
                Use your primary wallet funds (${withdrawableBalance.toFixed(2)} available).
              </p>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white/60 p-3 text-sm shadow-sm transition hover:border-primary/60 dark:border-slate-700 dark:bg-slate-900/60">
            <RadioGroupItem value="earnings" />
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground">Earnings Balance</div>
              <p className="text-xs text-muted-foreground">
                Withdraw from mining earnings (${earningsBalance.toFixed(2)} available).
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="withdraw-amount">Amount (USDT)</Label>
          <Input
            id="withdraw-amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min={minWithdraw}
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={`Enter at least $${minWithdraw.toFixed(2)}`}
          />
          <p className="text-xs text-muted-foreground">
            Withdraw at least ${minWithdraw.toFixed(2)} and no more than your selected balance.
          </p>
          <p className="text-xs font-semibold text-foreground">
            Available from selection: ${selectedBalance.toFixed(2)}
          </p>
          {exceedsSelectedBalance ? (
            <p className="text-xs text-destructive">Withdrawal amount cannot exceed your selected balance.</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <Label>Destination wallet</Label>
          <Tabs value={addressMode} onValueChange={(value) => setAddressMode(value as "saved" | "manual")}>
            <TabsList>
              <TabsTrigger value="saved" disabled={addresses.length === 0}>
                Saved addresses
              </TabsTrigger>
              <TabsTrigger value="manual">New address</TabsTrigger>
            </TabsList>

            <TabsContent value="saved" className="mt-3 space-y-3">
              {isLoadingAddresses ? (
                <p className="text-sm text-muted-foreground">Loading saved addresses…</p>
              ) : addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">You have no saved addresses yet.</p>
              ) : (
                <>
                  <Select value={selectedAddressId} onValueChange={setSelectedAddressId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a saved address" />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((address) => (
                        <SelectItem key={address.id} value={address.id}>
                          {address.label} · {address.chain}
                          {address.verified ? " ✅" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedAddress ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200">
                      {selectedAddress.address}
                    </div>
                  ) : null}
                </>
              )}

              {addressMode === "saved" && selectedAddress ? (
                <input type="hidden" name="walletAddress" value={selectedAddress.address} />
              ) : null}
            </TabsContent>

            <TabsContent value="manual" className="mt-3 space-y-2">
              <Input
                name="walletAddress"
                value={manualAddress}
                onChange={(event) => setManualAddress(event.target.value)}
                placeholder="Enter the USDT wallet address"
                autoComplete="off"
                required={addressMode === "manual"}
              />
              <p className="text-xs text-muted-foreground">
                Double-check the address network. Withdrawals sent to the wrong chain cannot be recovered.
              </p>
            </TabsContent>
          </Tabs>

          {addressError && <p className="text-xs text-destructive">{addressError}</p>}
        </div>
      </div>

      <SubmitButton />
    </form>
  )
}

export default WithdrawForm
