"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  Clock,
  Users,
  DollarSign,
  Loader2,
  UserCheck,
  Share2,
  Wallet,
  Network,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/utils/formatting"
import type { LucideIcon } from "lucide-react"

interface Task {
  id: string
  title: string
  description: string
  reward: number
  type: "daily" | "referral" | "deposit" | "mining" | "profile" | "social" | "team" | "balance"
  completed: boolean
  progress: number
  target: number
  rewardClaimed?: boolean
  level?: number
}

const iconMap: Record<Task["type"], LucideIcon> = {
  daily: CheckCircle2,
  referral: Users,
  deposit: DollarSign,
  mining: CheckCircle2,
  profile: UserCheck,
  social: Share2,
  team: Network,
  balance: Wallet,
}

const currencyTaskTypes = new Set<Task["type"]>(["deposit", "team"])

export default function TasksPage() {
  const [user, setUser] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    void fetchData()
  }, [])

  const fetchTasks = async () => {
    try {
      const tasksRes = await fetch("/api/tasks")
      if (!tasksRes.ok) return

      const tasksData = await tasksRes.json()
      if (Array.isArray(tasksData.tasks)) {
        setTasks(
          tasksData.tasks.map((task: Task) => ({
            ...task,
            rewardClaimed: Boolean(task.rewardClaimed),
          })),
        )
      } else {
        setTasks([])
      }
    } catch (error) {
      console.error("Failed to refresh tasks:", error)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        (async () => {
          const userRes = await fetch("/api/auth/me")
          if (userRes.ok) {
            const userData = await userRes.json()
            setUser(userData.user)
          }
        })(),
        fetchTasks(),
      ])
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClaimReward = async (taskId: string) => {
    setClaimingTaskId(taskId)
    try {
      const response = await fetch("/api/tasks/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast({
          variant: "destructive",
          title: "Unable to claim reward",
          description: data.error || "Please try again later.",
        })
        return
      }

      toast({
        title: "Reward successfully claimed",
        description: `Added ${formatCurrency(data.reward ?? 0)} to your balance.`,
      })

      await fetchTasks()
    } catch (error) {
      console.error("Failed to claim reward:", error)
      toast({
        variant: "destructive",
        title: "Unexpected error",
        description: "We couldn't process your request. Please try again later.",
      })
    } finally {
      setClaimingTaskId(null)
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
            <h1 className="text-3xl font-bold text-balance">Tasks & Rewards</h1>
            <p className="text-muted-foreground">Complete tasks to earn bonus rewards</p>
          </div>

          <div className="grid gap-6">
            {tasks.map((task) => {
              const Icon = iconMap[task.type] ?? CheckCircle2
              const progressPercentage = task.target > 0 ? (task.progress / task.target) * 100 : 0
              const isCurrencyTask = currencyTaskTypes.has(task.type)
              const formattedProgress = isCurrencyTask
                ? `$${task.progress.toFixed(2)} / $${task.target.toFixed(2)}`
                : `${task.progress} / ${task.target}`

              return (
                <Card key={task.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          {typeof task.level === "number" && (
                            <Badge variant="outline" className="mb-1 text-xs uppercase tracking-wide">
                              Level {task.level}
                            </Badge>
                          )}
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                          <CardDescription>{task.description}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-amber-600">+${task.reward}</div>
                        <Badge variant={task.rewardClaimed ? "default" : task.completed ? "default" : "secondary"}>
                          {task.rewardClaimed ? "Reward Claimed" : task.completed ? "Completed" : "In Progress"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progress</span>
                        <span>{formattedProgress}</span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" />
                      {task.completed ? (
                        <Button
                          className="w-full"
                          onClick={() => handleClaimReward(task.id)}
                          disabled={task.rewardClaimed || claimingTaskId === task.id}
                        >
                          {task.rewardClaimed ? (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Reward Claimed
                            </>
                          ) : claimingTaskId === task.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Claiming...
                            </>
                          ) : (
                            <>
                              <DollarSign className="mr-2 h-4 w-4" />
                              Claim Reward
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button variant="outline" className="w-full bg-transparent" disabled>
                          <Clock className="mr-2 h-4 w-4" />
                          Complete Task
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
