"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { TeamTree } from "@/components/team/team-tree"
import { LevelProgress } from "@/components/team/level-progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"

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
}

export default function TeamPage() {
  const [user, setUser] = useState<any>(null)
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [levelData, setLevelData] = useState<LevelData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [userRes, teamRes, levelRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/team/structure"),
        fetch("/api/levels/eligibility"),
      ])

      if (userRes.ok && teamRes.ok && levelRes.ok) {
        const userData = await userRes.json()
        const teamData = await teamRes.json()
        const levelData = await levelRes.json()

        setUser(userData.user)
        setTeamData(teamData)
        setLevelData(levelData)
      }
    } catch (error) {
      console.error("Failed to fetch team data:", error)
    } finally {
      setLoading(false)
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
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 md:ml-64 overflow-auto">
        <div className="p-6">
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
              {teamData?.teamTree ? (
                <div className="space-y-6">
                  <div className="text-sm text-muted-foreground">
                    Showing team members who have made deposits. Active members have deposited $80+ USDT.
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
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
