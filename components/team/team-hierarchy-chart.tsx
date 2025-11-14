"use client"

import { memo, useMemo } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const LEVEL_STYLES = [
  {
    card: "bg-gradient-to-r from-cyan-500 to-blue-500 border-blue-500/40",
    avatar: "ring-cyan-500/60 bg-cyan-500/10 text-cyan-600 dark:text-cyan-100",
    badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-100",
  },
  {
    card: "bg-gradient-to-r from-green-500 to-teal-500 border-green-500/40",
    avatar: "ring-green-500/60 bg-green-500/10 text-green-600 dark:text-green-100",
    badge: "bg-green-500/10 text-green-700 dark:text-green-100",
  },
  {
    card: "bg-gradient-to-r from-purple-500 to-pink-500 border-purple-500/40",
    avatar: "ring-purple-500/60 bg-purple-500/10 text-purple-600 dark:text-purple-100",
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-100",
  },
  {
    card: "bg-gradient-to-r from-amber-500 to-orange-500 border-amber-500/40",
    avatar: "ring-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-100",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-100",
  },
] as const

function getInitials(name?: string | null, email?: string | null) {
  const source = name && name.trim().length > 0 ? name : email ?? "Member"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "TM"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—"
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getRoleLabel(depth: number) {
  if (depth === 0) return "Team Leader"
  if (depth === 1) return "Level 1 Referral"
  if (depth === 2) return "Level 2 Referral"
  return `Level ${depth} Member`
}

function getProgressLabel(member: TeamHierarchyMember) {
  if (member.qualified) return "Qualified"
  if (member.isActive) return "Active"
  return "Progressing"
}

interface MemberNodeProps {
  member: TeamHierarchyMember
  depth: number
  maxDepth: number
}

const MemberNode = memo(function MemberNode({ member, depth, maxDepth }: MemberNodeProps) {
  if (!member || depth >= maxDepth) {
    return null
  }

  const styles = LEVEL_STYLES[depth % LEVEL_STYLES.length]
  const levelValue = typeof member.level === "number" && Number.isFinite(member.level) ? member.level : null
  const directCount = typeof member.directCount === "number" ? member.directCount : 0
  const activeCount = typeof member.activeCount === "number" ? member.activeCount : 0
  const progressionLabel = getProgressLabel(member)

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          "relative flex w-24 h-24 flex-col items-center gap-2 rounded-2xl border p-4 text-sm shadow-md",
          "bg-gradient-to-br",
          styles.card,
        )}
      >
        <Avatar
          className={cn(
            "h-12 w-12 border-4 border-background shadow-lg",
            "ring-4",
            styles.avatar,
          )}
        >
          {member.profileAvatar ? (
            <AvatarImage src={member.profileAvatar} alt={member.name ?? member.email ?? "Team member"} />
          ) : null}
          <AvatarFallback className="text-base font-semibold uppercase">
            {getInitials(member.name, member.email)}
          </AvatarFallback>
        </Avatar>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold">{member.name ?? "Unnamed member"}</h3>
          <p className="text-[10px] text-muted-foreground">{member.email ?? "Email unavailable"}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1">
          <Badge variant="secondary" className={cn("border-none", styles.badge)}>
            {getRoleLabel(depth)}
          </Badge>
          {levelValue !== null ? (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Level {levelValue}
            </Badge>
          ) : null}
          <Badge
            variant={member.qualified ? "default" : member.isActive ? "outline" : "secondary"}
            className={cn(
              member.qualified
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-200"
                : member.isActive
                  ? "border-amber-400/50 text-amber-600 dark:text-amber-200"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {progressionLabel}
          </Badge>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-lg border border-border/40 bg-background/60 p-2">
            <p className="text-muted-foreground">Team deposits</p>
            <p className="font-semibold">{formatCurrency(member.depositTotal ?? null)}</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/60 p-2">
            <p className="text-muted-foreground">Direct referrals</p>
            <p className="font-semibold">{directCount}</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/60 p-2">
            <p className="text-muted-foreground">Active referrals</p>
            <p className="font-semibold text-emerald-600 dark:text-emerald-300">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/60 p-2">
            <p className="text-muted-foreground">Joined</p>
            <p className="font-semibold">{formatDate(member.createdAt)}</p>
          </div>
        </div>

        {member.referralCode ? (
          <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            Code: <span className="text-foreground">{member.referralCode}</span>
          </p>
        ) : null}
      </div>

      {member.children && member.children.length > 0 ? (
        <div className="relative mt-6 w-full">
          <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 -translate-y-6 bg-border/70" />
          <div className="relative flex flex-wrap justify-center gap-4 pt-6">
            {member.children.map((child) => (
              <div key={child._id ?? `${member._id}-child`} className="relative">
                <MemberNode member={child} depth={depth + 1} maxDepth={maxDepth} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
})

MemberNode.displayName = "MemberNode"

export function TeamHierarchyChart({ teamTree, teamStats, maxDepth = 4 }: TeamHierarchyChartProps) {
  const flattenedLevels = useMemo(() => {
    const levels: number[] = []

    function traverse(node: TeamHierarchyMember | null, depth: number) {
      if (!node || depth >= maxDepth) {
        return
      }

      levels[depth] = (levels[depth] ?? 0) + 1

      if (Array.isArray(node.children)) {
        node.children.forEach((child) => traverse(child, depth + 1))
      }
    }

    traverse(teamTree, 0)
    return levels
  }, [teamTree, maxDepth])

  const totalMembers = teamStats?.totalMembers ?? flattenedLevels.reduce((acc, count) => acc + count, 0)
  const activeMembers = teamStats?.activeMembers ?? undefined

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-semibold">Team hierarchy</CardTitle>
        <p className="text-sm text-muted-foreground">
          Visualize how your team is structured and track how members progress across levels.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Badge variant="outline" className="border-border/50 bg-muted/30 text-muted-foreground">
            Levels visible: {flattenedLevels.length}
          </Badge>
          <Badge variant="outline" className="border-border/50 bg-muted/30 text-muted-foreground">
            Members mapped: {totalMembers}
          </Badge>
          {typeof activeMembers === "number" ? (
            <Badge variant="outline" className="border-emerald-400/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200">
              Active: {activeMembers}
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col items-center gap-6">
          <MemberNode member={teamTree} depth={0} maxDepth={maxDepth} />
        </div>
      </CardContent>
    </Card>
  )
}
