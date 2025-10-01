"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, Clock, Gift, Users, DollarSign, Loader2 } from "lucide-react"

interface Task {
  id: string
  title: string
  description: string
  reward: number
  type: "daily" | "referral" | "deposit" | "mining"
  completed: boolean
  progress: number
  target: number
  icon: any
}

export default function TasksPage() {
  const [user, setUser] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch("/api/auth/me")
        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData.user)
        }

        // Mock tasks data - in real app, this would come from API
        setTasks([
         
          {
            id: "1",
            title: "Refer 3 Friends",
            description: "Invite 3 friends to join the platform",
            reward: 2,
            type: "referral",
            completed: false,
            progress: 1,
            target: 3,
            icon: Users,
          },
          {
            id: "2",
            title: "First Deposit",
            description: "Make your first deposit of $100 or more",
            reward: 2,
            type: "deposit",
            completed: false,
            progress: 0,
            target: 1,
            icon: DollarSign,
          },
          {
            id: "3",
            title: "Mine 10 Times",
            description: "Complete 10 mining sessions",
            reward: 0.5,
            type: "mining",
            completed: false,
            progress: 3,
            target: 10,
            icon: Gift,
          },
        ])
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleClaimReward = async (taskId: string) => {
    // In real app, this would call API to claim reward
    console.log("Claiming reward for task:", taskId)
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
              const Icon = task.icon
              const progressPercentage = (task.progress / task.target) * 100

              return (
                <Card key={task.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                          <CardDescription>{task.description}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-amber-600">+${task.reward}</div>
                        <Badge variant={task.completed ? "default" : "secondary"}>
                          {task.completed ? "Completed" : "In Progress"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progress</span>
                        <span>
                          {task.progress} / {task.target}
                        </span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" />
                      {task.completed ? (
                        <Button className="w-full" onClick={() => handleClaimReward(task.id)}>
                          <Gift className="mr-2 h-4 w-4" />
                          Claim Reward
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
