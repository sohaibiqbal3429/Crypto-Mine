"use client"

import { useCallback } from "react"
import { Share2, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
    <Card className="relative h-full overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-400 px-6 py-6 text-white shadow-[0_25px_50px_rgba(79,70,229,0.45)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_60%)]" aria-hidden />
      <CardContent className="relative flex h-full flex-col justify-between px-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-white/70">Invite &amp; earn</p>
              <p className="mt-2 text-2xl font-semibold">Unlock 15% daily boosts</p>
            </div>
            <Share2 className="h-6 w-6" aria-hidden />
          </div>
          <p className="text-sm text-white/80">Earn a percentage of your crew&apos;s daily mining once they activate their rigs.</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/40 bg-white/10 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">Your code</p>
            <p className="mt-2 text-3xl font-bold">{referralCode}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={handleCopyCode} className="flex-1 rounded-2xl bg-white text-foreground hover:bg-white/90">
                Copy code
              </Button>
              <Button
                variant="outline"
                onClick={handleShare}
                className="flex-1 rounded-2xl border-white/50 bg-transparent text-white hover:bg-white/10"
              >
                Share link
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/40 bg-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-white/15 p-2 text-white">
                <Users className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{activeInvites} active invite{activeInvites === 1 ? "" : "s"}</p>
                <p className="text-xs text-white/70">${totalEarnedUsd.toFixed(2)} earned so far</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
