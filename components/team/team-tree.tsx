"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Users, TrendingUp, Calendar } from "lucide-react"

interface TeamMember {
  _id: string
  name: string
  email: string
  referralCode: string
  level: number
  depositTotal: number
  isActive: boolean
  qualified?: boolean
  createdAt: string
  children?: TeamMember[]
  directCount: number
  activeCount: number
}

interface TeamTreeProps {
  teamTree: TeamMember | null
  maxDepth?: number
  currentDepth?: number
}

export function TeamTree({ teamTree, maxDepth = 3, currentDepth = 0 }: TeamTreeProps) {
  if (!teamTree || currentDepth >= maxDepth) return null

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="space-y-4">
      <Card className={`${currentDepth === 0 ? "border-primary" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-600 text-white">
                {getInitials(teamTree.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{teamTree.name}</h3>
                  <p className="text-sm text-muted-foreground">{teamTree.email}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={teamTree.level > 0 ? "default" : "secondary"}>Level {teamTree.level}</Badge>
                  {teamTree.qualified && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Active
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Deposits:</span>
                  <span className="font-medium">${teamTree.depositTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Direct:</span>
                  <span className="font-medium">{teamTree.directCount}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-muted-foreground">Active:</span>
                  <span className="font-medium text-green-600">{teamTree.activeCount}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Joined:</span>
                  <span className="font-medium">{formatDate(teamTree.createdAt)}</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                <span className="font-mono">Code: {teamTree.referralCode}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Render children */}
      {teamTree.children && teamTree.children.length > 0 && (
        <div className="ml-8 border-l-2 border-muted pl-4 space-y-4">
          {teamTree.children.map((child) => (
            <TeamTree key={child._id} teamTree={child} maxDepth={maxDepth} currentDepth={currentDepth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
