"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Award, CalendarClock, Trophy } from "lucide-react"

import type { LuckyDrawDeposit } from "@/lib/types/lucky-draw"
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

interface AdminWinnerBoxProps {
  round: {
    id: string
    startAtUtc: string
    endAtUtc: string
    prizePoolUsd: number
    totalEntries: number
    lastWinner?: {
      name: string
      announcedAt: string
    } | null
  }
  deposits: LuckyDrawDeposit[]
  onAnnounceWinner: (depositId: string) => void
  announcing?: boolean
  history?: RoundHistoryEntry[]
}

export function AdminWinnerBox({ round, deposits, onAnnounceWinner, announcing = false, history = [] }: AdminWinnerBoxProps) {
  const [selectedDepositId, setSelectedDepositId] = useState<string | undefined>(() => deposits.find((deposit) => deposit.status === "ACCEPTED")?.id)

  useEffect(() => {
    if (!selectedDepositId) {
      const accepted = deposits.find((deposit) => deposit.status === "ACCEPTED")
      if (accepted) {
        setSelectedDepositId(accepted.id)
      }
    }
  }, [deposits, selectedDepositId])

  const acceptedDeposits = deposits.filter((deposit) => deposit.status === "ACCEPTED")

  const handleAnnounce = () => {
    if (selectedDepositId) {
      onAnnounceWinner(selectedDepositId)
    }
  }

  return (
    <Card className="flex h-full flex-col border-0 bg-gradient-to-br from-purple-500/10 via-fuchsia-500/10 to-indigo-500/10 shadow-xl">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Winner Announcement</CardTitle>
          <Trophy className="h-6 w-6 text-purple-500" />
        </div>
        <p className="text-sm text-muted-foreground">
          Select a verified participant to crown the Blind Box Lucky Draw winner and automatically credit the prize pool.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <div className="space-y-3 rounded-xl border border-white/40 bg-white/60 p-4 shadow-inner">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <CalendarClock className="h-5 w-5 text-purple-500" />
            <span>Next draw closes on {format(new Date(round.endAtUtc), "MMM d, yyyy • HH:mm 'UTC'")}.</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge className="bg-purple-500/15 text-purple-600">Entries: {round.totalEntries}</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-600">Prize: ${round.prizePoolUsd.toFixed(2)}</Badge>
          </div>
          {round.lastWinner ? (
            <p className="text-xs text-muted-foreground">
              Last winner: <span className="font-semibold text-foreground">{round.lastWinner.name}</span> on {format(new Date(round.lastWinner.announcedAt), "MMM d, yyyy")}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Choose winner from accepted deposits</p>
          <Select value={selectedDepositId} onValueChange={(value) => setSelectedDepositId(value)}>
            <SelectTrigger className="bg-white/70">
              <SelectValue placeholder="Select an accepted deposit" />
            </SelectTrigger>
            <SelectContent>
              {acceptedDeposits.length === 0 ? (
                <SelectItem value="" disabled>
                  No accepted deposits yet
                </SelectItem>
              ) : (
                acceptedDeposits.map((deposit) => (
                  <SelectItem key={deposit.id} value={deposit.id}>
                    {(deposit.userName ?? "Participant").trim()} • {deposit.txHash}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={handleAnnounce} disabled={!selectedDepositId || announcing || acceptedDeposits.length === 0}>
            <Award className="mr-2 h-4 w-4" />
            {announcing ? "Announcing…" : `Announce & Credit $${round.prizePoolUsd.toFixed(2)}`}
          </Button>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Round history</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            {history.length === 0 ? (
              <p>No previous rounds logged yet.</p>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border border-white/40 bg-white/50 p-2">
                  <span className="font-medium text-foreground">{entry.winner}</span>
                  <span>
                    {format(new Date(entry.announcedAt), "MMM d, yyyy")} • ${entry.prizeUsd.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
