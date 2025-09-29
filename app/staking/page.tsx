"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Clock, DollarSign, Loader2 } from "lucide-react"
import Image from "next/image"

interface StakingPool {
  id: string
  name: string
  apy: number
  minStake: number
  lockPeriod: number
  totalStaked: number
  userStaked: number
  rewards: number
}

export default function StakingPage() {
  const [user, setUser] = useState<any>(null)
  const [pools, setPools] = useState<StakingPool[]>([])
  const [loading, setLoading] = useState(true)
  const [stakeAmount, setStakeAmount] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch("/api/auth/me")
        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData.user)
        }

        // Mock staking pools - in real app, this would come from API
        setPools([
          {
            id: "pcoin-30",
            name: "P-Coin 30 Days",
            apy: 12.5,
            minStake: 100,
            lockPeriod: 30,
            totalStaked: 1250000,
            userStaked: 500,
            rewards: 15.67,
          },
          {
            id: "pcoin-90",
            name: "P-Coin 90 Days",
            apy: 18.0,
            minStake: 250,
            lockPeriod: 90,
            totalStaked: 850000,
            userStaked: 0,
            rewards: 0,
          },
          {
            id: "pcoin-365",
            name: "P-Coin 1 Year",
            apy: 25.0,
            minStake: 500,
            lockPeriod: 365,
            totalStaked: 2100000,
            userStaked: 1000,
            rewards: 68.49,
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

  const handleStake = async (poolId: string) => {
    // In real app, this would call API to stake tokens
    console.log("Staking", stakeAmount, "in pool", poolId)
  }

  const handleUnstake = async (poolId: string) => {
    // In real app, this would call API to unstake tokens
    console.log("Unstaking from pool", poolId)
  }

  const handleClaimRewards = async (poolId: string) => {
    // In real app, this would call API to claim rewards
    console.log("Claiming rewards from pool", poolId)
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
            <h1 className="text-3xl font-bold text-balance">P-Coin Staking</h1>
            <p className="text-muted-foreground">Stake your P-Coins to earn passive rewards</p>
          </div>

          <div className="grid gap-6">
            {pools.map((pool) => (
              <Card key={pool.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Image
                          src="/images/logo.jpg"
                          alt="Mintmine Pro"
                          width={32}
                          height={32}
                          className="rounded-lg"
                        />
                        {pool.name}
                      </CardTitle>
                      <CardDescription>
                        Lock period: {pool.lockPeriod} days • Min stake: {pool.minStake} PCN
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-lg font-bold">
                      {pool.apy}% APY
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Pool Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Total Staked</span>
                      </div>
                      <div className="text-xl font-bold">{pool.totalStaked.toLocaleString()} PCN</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Your Stake</span>
                      </div>
                      <div className="text-xl font-bold">{pool.userStaked.toLocaleString()} PCN</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Pending Rewards</span>
                      </div>
                      <div className="text-xl font-bold text-green-600">{pool.rewards.toFixed(2)} PCN</div>
                    </div>
                  </div>

                  {/* Staking Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label htmlFor={`stake-${pool.id}`}>Stake Amount</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`stake-${pool.id}`}
                          type="number"
                          placeholder={`Min ${pool.minStake} PCN`}
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(e.target.value)}
                        />
                        <Button onClick={() => handleStake(pool.id)}>Stake</Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Manage Stake</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleUnstake(pool.id)}
                          disabled={pool.userStaked === 0}
                          className="flex-1"
                        >
                          Unstake
                        </Button>
                        <Button
                          onClick={() => handleClaimRewards(pool.id)}
                          disabled={pool.rewards === 0}
                          className="flex-1"
                        >
                          Claim Rewards
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar for Lock Period */}
                  {pool.userStaked > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Lock Period Progress</span>
                        <span>15 / {pool.lockPeriod} days</span>
                      </div>
                      <Progress value={(15 / pool.lockPeriod) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {pool.lockPeriod - 15} days remaining until unlock
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
