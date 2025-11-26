"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Award, CalendarClock, Trophy } from "lucide-react"

import type { LuckyDrawDeposit } from "@/lib/types/lucky-draw"
import { ensureDate, ensureNumber } from "@/lib/utils/safe-parsing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RoundHistoryEntry {
  id: string
  winner: string
  announcedAt: string
  prizeUsd: number
}

interface PendingAnnouncementSummary {
  id: string
  winner: string
  announcementAt: string
  prizeUsd: number
}

interface AdminWinnerBoxProps {
  round: {
    id: string
    startAtUtc: string
    endAtUtc: string
    prizePoolUsd: number
    announcementAtUtc?: string
    totalEntries: number
    selectedWinner?: {
      depositId?: string | null
    } | null
    lastWinner?: {
      name: string
      announcedAt: string
    } | null
  }
  deposits: LuckyDrawDeposit[]
  onAnnounceWinner: (depositId: string) => void
  announcing?: boolean
  history?: RoundHistoryEntry[]
  pendingAnnouncement?: PendingAnnouncementSummary | null
}

export function AdminWinnerBox({
  round,
  deposits,
  onAnnounceWinner,
  announcing = false,
  history = [],
  pendingAnnouncement,
}: AdminWinnerBoxProps) {
  const roundSelectedDepositId = round.selectedWinner?.depositId ?? undefined
  const [selectedDepositId, setSelectedDepositId] = useState<string | undefined>(
    () => roundSelectedDepositId ?? deposits.find((deposit) => deposit.status === "APPROVED")?.id,
  )

  const prizePool = ensureNumber(round.prizePoolUsd, 0)
  const roundClose = ensureDate(round.announcementAtUtc ?? round.endAtUtc)
  const roundCloseLabel = roundClose ? format(roundClose, "MMM d, yyyy • HH:mm 'UTC'") : "Date TBD"
  const lastWinnerDate = ensureDate(round.lastWinner?.announcedAt)
  const pendingAnnouncementDate = ensureDate(pendingAnnouncement?.announcementAt)

  useEffect(() => {
    if (roundSelectedDepositId) {
      setSelectedDepositId(roundSelectedDepositId)
      return
    }

    if (!selectedDepositId) {
      const accepted = deposits.find((deposit) => deposit.status === "APPROVED")
      if (accepted) {
        setSelectedDepositId(accepted.id)
      }
    }
  }, [deposits, roundSelectedDepositId, selectedDepositId])

  const approvedDeposits = deposits.filter((deposit) => deposit.status === "APPROVED")

  const handleAnnounce = () => {
    if (selectedDepositId) {
      onAnnounceWinner(selectedDepositId)
    }
  }

  return (
    <Card className="flex h-full flex-col border-0 bg-gradient-to-br from-purple-500/10 via-fuchsia-500/10 to-indigo-500/10 py-5 shadow-xl">
      <CardHeader className="space-y-3 px-5 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Winner Announcement</CardTitle>
          <Trophy className="h-6 w-6 text-purple-500" />
        </div>
        <p className="text-sm text-muted-foreground">
          Select a verified participant to lock in the Blind Box Lucky Draw winner. The official reveal and prize credit happen 72 hours after the selection is scheduled.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5 px-5 pb-5">
        <div className="space-y-3 rounded-xl border border-white/40 bg-white/60 p-4 shadow-inner">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <CalendarClock className="h-5 w-5 text-purple-500" />
            <span>Next draw closes on {roundCloseLabel}.</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge className="bg-purple-500/15 text-purple-600">Entries: {round.totalEntries}</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-600">Prize: ${prizePool.toFixed(2)}</Badge>
          </div>
          {round.lastWinner ? (
            <p className="text-xs text-muted-foreground">
              Last winner: <span className="font-semibold text-foreground">{round.lastWinner.name}</span> on {lastWinnerDate ? format(lastWinnerDate, "MMM d, yyyy") : "Unknown"}
            </p>
          ) : null}
        </div>

        {pendingAnnouncement ? (
          <div className="space-y-2 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs text-muted-foreground">
            <p>
              Winner selected: <span className="font-semibold text-foreground">{pendingAnnouncement.winner}</span>
            </p>
            <p>
              Official announcement scheduled for {pendingAnnouncementDate ? format(pendingAnnouncementDate, "MMM d, yyyy • HH:mm 'UTC'") : "TBD"}.
            </p>
            <Badge className="bg-purple-500/20 text-purple-700">Prize ${ensureNumber(pendingAnnouncement.prizeUsd, 0).toFixed(2)}</Badge>
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Choose winner from accepted deposits</p>
          <Select
            value={selectedDepositId}
            onValueChange={(value) => setSelectedDepositId(value)}
            disabled={approvedDeposits.length === 0}
          >
            <SelectTrigger className="bg-white/70">
              <SelectValue placeholder="Select an approved deposit" />
            </SelectTrigger>
            <SelectContent>
              {approvedDeposits.length === 0 ? (
                <SelectItem value="__no-approved" disabled>
                  No approved deposits yet
                </SelectItem>
              ) : (
                approvedDeposits.map((deposit) => (
                  <SelectItem key={deposit.id} value={deposit.id}>
                    {(deposit.userName ?? "Participant").trim()} • {deposit.txHash}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={handleAnnounce} disabled={!selectedDepositId || announcing || approvedDeposits.length === 0}>
            <Award className="mr-2 h-4 w-4" />
            {announcing ? "Scheduling…" : `Schedule announcement & credit $${prizePool.toFixed(2)}`}
          </Button>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Round history</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            {history.length === 0 ? (
              <p>No previous rounds logged yet.</p>
            ) : (
              history.map((entry) => {
                const historyDate = ensureDate(entry.announcedAt)
                const prize = ensureNumber(entry.prizeUsd, 0)
                return (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg border border-white/40 bg-white/50 p-2">
                    <span className="font-medium text-foreground">{entry.winner}</span>
                    <span>
                      {(historyDate ? format(historyDate, "MMM d, yyyy") : "Unknown")} • ${prize.toFixed(2)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
