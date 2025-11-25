"use client"

import { HandCoins, History } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate, formatTime } from "@/lib/utils/formatting"
import { ensureDate } from "@/lib/utils/safe-parsing"

interface TeamRewardsCardProps {
  available: number
  claimedTotal: number
  lastClaimedAt?: string | null
  isClaiming: boolean
  onClaim: () => void
  isLocked?: boolean
  unlockLevel?: number
}

export function TeamRewardsCard({
  available,
  claimedTotal,
  lastClaimedAt,
  isClaiming,
  onClaim,
  isLocked = false,
  unlockLevel = 1,
}: TeamRewardsCardProps) {
  const canClaim = available > 0 && !isClaiming && !isLocked
  const lastClaimedDate = ensureDate(lastClaimedAt)
  const formattedLastClaim = lastClaimedDate
    ? `${formatDate(lastClaimedDate, "long")} at ${formatTime(lastClaimedDate)}`
    : null
  const unlockLabel = `Level ${unlockLevel}`

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <HandCoins className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Team Rewards Wallet</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isLocked
                ? `Reach ${unlockLabel} to unlock daily team earnings and start crediting them to your main balance.`
                : "Daily team earnings accumulate here. Claim to credit them to your main balance."}
            </p>
          </div>
        </div>
        <Badge variant={isLocked ? "secondary" : available > 0 ? "default" : "secondary"} className="w-fit">
          {isLocked ? `Unlocks at ${unlockLabel}` : available > 0 ? "Rewards available" : "No rewards available"}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Available to claim</p>
          <p className="text-2xl font-semibold text-primary">{formatCurrency(available)}</p>
          <Button onClick={onClaim} disabled={!canClaim} className="w-full sm:w-auto">
            {isLocked ? `Locked until ${unlockLabel}` : isClaiming ? "Claiming..." : "Claim rewards"}
          </Button>
          {isLocked ? (
            <p className="text-xs text-muted-foreground">
              You&apos;ll start receiving team rewards once you reach {unlockLabel}.
            </p>
          ) : null}
        </div>
        <div className="space-y-3 rounded-lg border border-dashed border-muted p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <History className="h-4 w-4" />
            Lifetime claimed
          </div>
          <p className="text-xl font-semibold">{formatCurrency(claimedTotal)}</p>
          <div className="text-xs text-muted-foreground">
            {formattedLastClaim ? `Last claimed on ${formattedLastClaim}` : "Claim rewards to start building history."}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
