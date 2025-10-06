"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { TeamTree } from "@/components/team/team-tree"
import { LevelProgress } from "@/components/team/level-progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { TeamRewardsCard } from "@/components/team/team-rewards-card"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/utils/formatting"

interface TeamData {
  teamTree: any
  teamStats: any
}

interface LevelData {
  currentLevel: number
  currentRule: any
  nextRule: any
  levelProgress: any
  teamStats: any
  allRules: any[]
  directActiveCount: number
  totalActiveDirects: number
  lastLevelUpAt: string | null
  message: string
}

export default function TeamPage() {
  const [user, setUser] = useState<any>(null)
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [levelData, setLevelData] = useState<LevelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamRewards, setTeamRewards] = useState<{
    available: number
    claimedTotal: number
    lastClaimedAt: string | null
  } | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [userRes, teamRes, levelRes, rewardsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/team/structure"),
        fetch("/api/levels/eligibility"),
        fetch("/api/team/rewards"),
      ])

      if (userRes.ok && teamRes.ok && levelRes.ok) {
        const userData = await userRes.json()
        const teamData = await teamRes.json()
        const levelData = await levelRes.json()

        setUser(userData.user)
        setTeamData(teamData)
        setLevelData(levelData)
      }

      if (rewardsRes.ok) {
        const rewardsData = await rewardsRes.json()
        setTeamRewards({
          available: rewardsData.available ?? 0,
          claimedTotal: rewardsData.claimedTotal ?? 0,
          lastClaimedAt: rewardsData.lastClaimedAt ?? null,
        })
      }
    } catch (error) {
      console.error("Failed to fetch team data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClaimRewards = async () => {
    if (!teamRewards) return

    setIsClaiming(true)
    try {
      const response = await fetch("/api/team/rewards", { method: "POST" })
      const data = await response.json()

      if (!response.ok) {
        toast({
          variant: "destructive",
          title: "Unable to claim rewards",
          description: data.error || "Please try again in a moment.",
        })
        return
      }

      setTeamRewards({
        available: data.available ?? 0,
        claimedTotal: data.claimedTotal ?? 0,
        lastClaimedAt: data.lastClaimedAt ?? null,
      })

      toast({
        title: "Rewards added to balance",
        description: `Successfully claimed ${formatCurrency(data.creditedAmount || 0)}.`,
      })
    } catch (error) {
      console.error("Claim rewards error:", error)
      toast({
        variant: "destructive",
        title: "Unexpected error",
        description: "We couldn't process your claim. Please try again.",
      })
    } finally {
      setIsClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto md:ml-64">
        <div className="p-5 sm:p-6 lg:p-8 space-y-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-balance">Team Management</h1>
            <p className="text-muted-foreground">View your team structure and level progress</p>
          </div>

          <Tabs defaultValue="structure" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="structure">Team Structure</TabsTrigger>
              <TabsTrigger value="levels">Levels & Progress</TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="space-y-6">
              {teamRewards && (
                <TeamRewardsCard
                  available={teamRewards.available}
                  claimedTotal={teamRewards.claimedTotal}
                  lastClaimedAt={teamRewards.lastClaimedAt}
                  isClaiming={isClaiming}
                  onClaim={handleClaimRewards}
                />
              )}

              {teamData?.teamTree ? (
                <div className="space-y-6">
                  <div className="text-sm text-muted-foreground">
                    Showing team members who have made deposits. Active members have deposited at least $80 USDT in a single qualifying transaction.
                  </div>
                  <TeamTree teamTree={teamData.teamTree} />
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No team members found. Start referring users to build your team!
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="levels" className="space-y-6">
              {levelData && (
                <LevelProgress
                  currentLevel={levelData.currentLevel}
                  levelProgress={levelData.levelProgress}
                  teamStats={levelData.teamStats}
                  currentRule={levelData.currentRule}
                  nextRule={levelData.nextRule}
                  directActiveCount={levelData.directActiveCount}
                  totalActiveDirects={levelData.totalActiveDirects}
                  lastLevelUpAt={levelData.lastLevelUpAt}
                  message={levelData.message}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
