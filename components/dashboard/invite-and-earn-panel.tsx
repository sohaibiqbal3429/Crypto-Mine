"use client"

import { useCallback } from "react"
import { Share2, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

interface InviteAndEarnPanelProps {
  referralCode?: string
  activeInvites?: number
  totalEarnedUsd?: number
}

export function InviteAndEarnPanel({ referralCode = "CRYPTO123", activeInvites = 1, totalEarnedUsd = 0 }: InviteAndEarnPanelProps) {
  const { toast } = useToast()

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralCode)
      toast({ description: "Referral code copied to clipboard." })
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", description: "Unable to copy the code. Try copying manually." })
    }
  }, [referralCode, toast])

  const handleShare = useCallback(async () => {
    const referralLink = `https://mintminepro.com/auth/register?ref=${encodeURIComponent(referralCode)}`

    try {
      await navigator.clipboard.writeText(referralLink)
      toast({ description: "Referral link copied to clipboard." })
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", description: "Unable to copy the referral link. Try copying manually." })
    }

    if (navigator.share) {
      const sharePayload = {
        title: "Join me on Mintmine Pro",
        text: `Use my referral code ${referralCode} to start mining and earn rewards together!`,
        url: referralLink,
      }

      try {
        await navigator.share(sharePayload)
        toast({ description: "Invite shared successfully." })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        console.error(error)
        toast({ variant: "destructive", description: "Unable to complete sharing." })
      }
    } else {
      toast({ description: "Sharing isn't supported here. Send the copied link directly." })
    }
  }, [referralCode, toast])

  return (
    <Card className="dashboard-card flex h-full flex-col border-0 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-sky-500/10 shadow-lg">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Invite &amp; Earn</CardTitle>
          <Share2 className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="text-sm text-muted-foreground">
          Earn 15% of your friends’ daily earnings when they start mining with your referral link.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-white/50 bg-white/60 p-4 shadow-inner">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your referral code</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{referralCode}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleCopyCode}>
                Copy Code
              </Button>
              <Button size="sm" variant="outline" className="backdrop-blur" onClick={handleShare}>
                Share &amp; Invite
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/40 bg-white/60 p-4">
            <span className="rounded-full bg-emerald-500/20 p-2 text-emerald-600">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Invite progress</p>
              <p className="text-xs text-muted-foreground">
                {activeInvites} active invite{activeInvites === 1 ? "" : "s"} | ${totalEarnedUsd.toFixed(2)} earned from referrals
              </p>
            </div>
          </div>
        </div>

        <Badge className="w-fit bg-emerald-500/15 text-emerald-600">Rewards paid to your current balance automatically</Badge>
      </CardContent>
    </Card>
  )
}
