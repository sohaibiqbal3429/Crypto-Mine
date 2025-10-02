"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Zap, Clock, AlertCircle, Coins } from "lucide-react"
import { motion } from "framer-motion"

import { mineAction } from "@/app/mining/actions"

interface MiningWidgetProps {
  mining: {
    canMine: boolean
    nextEligibleAt: string
    earnedInCycle: number
    requiresDeposit?: boolean
    minDeposit?: number
  }
}

export function MiningWidget({ mining }: MiningWidgetProps) {
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({})
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [canMine, setCanMine] = useState(mining.canMine)

  useEffect(() => {
    setCanMine(mining.canMine)
  }, [mining.canMine])

  const handleMining = () => {
    setFeedback({})
    startTransition(async () => {
      const result = await mineAction()
      if (result.error) {
        setFeedback({ error: result.error })
        return
      }
      setFeedback({ success: result.success ?? "Mining successful!" })
      setCanMine(false)
      router.refresh()
    })
  }

  const getTimeUntilNext = () => {
    if (!mining.nextEligibleAt) return "Ready to mine!"
    const now = new Date()
    const nextTime = new Date(mining.nextEligibleAt)
    const diff = nextTime.getTime() - now.getTime()

    if (diff <= 0) return "Ready to mine!"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`
  }

  return (
    <Card className="col-span-full lg:col-span-2 crypto-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
              <Coins className="w-6 h-6 text-primary-foreground" />
            </div>
            {canMine && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <div className="crypto-gradient-text text-xl font-bold">P-Coin Mining</div>
            <div className="text-sm text-muted-foreground">Decentralized Mining Protocol</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {feedback.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{feedback.error}</AlertDescription>
          </Alert>
        )}

        {feedback.success && (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <Zap className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">{feedback.success}</AlertDescription>
          </Alert>
        )}

        <div className="text-center space-y-6">
          <motion.div
            className="relative mx-auto w-40 h-40 flex items-center justify-center"
            whileHover={{ scale: canMine ? 1.05 : 1 }}
            whileTap={{ scale: canMine ? 0.95 : 1 }}
          >
            <div
              className={`w-full h-full rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl relative overflow-hidden ${
                canMine
                  ? "bg-gradient-to-br from-primary to-accent cursor-pointer crypto-glow"
                  : "bg-gradient-to-br from-gray-400 to-gray-600 cursor-not-allowed"
              }`}
              onClick={canMine ? handleMining : undefined}
            >
              <Coins className="w-16 h-16" />
              {canMine && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent opacity-30"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </>
              )}
            </div>
          </motion.div>

          <div className="space-y-3">
            {canMine ? (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-4 py-2"
              >
                <Zap className="w-4 h-4 mr-2" />
                Mining Available
              </Badge>
            ) : mining.requiresDeposit ? (
              <Badge
                variant="secondary"
                className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 px-4 py-2"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Deposit Required
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-4 py-2"
              >
                <Clock className="w-4 h-4 mr-2" />
                Cooldown Period
              </Badge>
            )}
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm font-medium text-muted-foreground">Next Mining Window</p>
              <p className="text-lg font-mono font-bold text-foreground">{getTimeUntilNext()}</p>
            </div>
          </div>

          <Button
            onClick={handleMining}
            disabled={!canMine || isPending}
            size="lg"
            className="w-full max-w-sm h-12 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Mining in Progress...
              </>
            ) : (
              <>
                <Zap className="mr-3 h-5 w-5" />
                {canMine ? "Start Mining" : "Mining Unavailable"}
              </>
            )}
          </Button>

          {mining.requiresDeposit && (
            <Button
              asChild
              variant="outline"
              className="w-full max-w-sm h-11 border-dashed border-slate-300 text-sm font-semibold"
            >
              <Link href="/wallet/deposit">
                Make a deposit (min ${mining.minDeposit?.toFixed(0) ?? 30} USDT)
              </Link>
            </Button>
          )}

          {mining.earnedInCycle > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <p className="text-sm text-muted-foreground mb-1">Last Mining Cycle</p>
              <p className="text-2xl font-bold crypto-gradient-text">+${mining.earnedInCycle.toFixed(2)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
