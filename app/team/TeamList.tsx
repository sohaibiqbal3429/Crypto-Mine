"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils/formatting"

interface TeamMember {
  _id: string
  name?: string
  level?: number
  qualified?: boolean
  depositTotal?: number
  referredBy?: string
  createdAt?: string
}

interface TeamListResponse {
  items: TeamMember[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

interface TeamListProps {
  userId?: string
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: "include" })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const message = typeof error.error === "string" ? error.error : "Unable to load team members"
    throw new Error(message)
  }

  return (await response.json()) as TeamListResponse
}

const PAGE_SIZE = 20

export function TeamList({ userId }: TeamListProps) {
  const [page, setPage] = useState(1)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const key = userId ? `/api/team?userId=${userId}&page=${page}&limit=${PAGE_SIZE}` : null

  const { data, error, isLoading, isValidating, mutate } = useSWR<TeamListResponse>(key, fetcher, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    setPage(1)
    setMembers([])
    setTotal(0)
    setHasMore(false)
  }, [userId])

  useEffect(() => {
    if (!data) {
      return
    }

    setTotal(data.total)
    setHasMore(data.hasMore)

    setMembers((previous) => {
      if (page === 1) {
        return data.items
      }

      const merged = new Map(previous.map((member) => [member._id, member]))
      for (const member of data.items) {
        merged.set(member._id, member)
      }
      return Array.from(merged.values())
    })
  }, [data, page])

  const isInitialLoading = isLoading && members.length === 0
  const isRefreshing = isValidating && members.length > 0

  const summary = useMemo(() => {
    if (total === 0) {
      return "Keep building your network to see referrals here."
    }

    return `Showing ${members.length} of ${total} direct referrals`
  }, [members.length, total])

  if (!userId) {
    return <TeamListSkeleton />
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Team directory</h2>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void mutate()
          }}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card">
        {isInitialLoading ? (
          <TeamListSkeleton />
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error.message}</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No direct referrals yet. Share your referral code to grow your team.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {members.map((member) => {
              const joinedLabel = member.createdAt
                ? `Joined ${formatDistanceToNow(new Date(member.createdAt), { addSuffix: true })}`
                : "Joined date unavailable"
              const levelLabel = typeof member.level === "number" ? `Level L${member.level}` : "Level N/A"

              return (
                <li
                  key={member._id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium sm:text-base">{member.name ?? "Unnamed member"}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{joinedLabel}</span>
                      <span className="hidden h-1 w-1 rounded-full bg-border/70 sm:block" aria-hidden />
                      <span>{levelLabel}</span>
                      <span className="hidden h-1 w-1 rounded-full bg-border/70 sm:block" aria-hidden />
                      <span>{formatCurrency(member.depositTotal ?? 0)} deposited</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={member.qualified ? "default" : "secondary"}>
                      {member.qualified ? "Qualified" : "Not qualified"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ID ending in {member._id.slice(-6)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setPage((current) => current + 1)
            }}
            disabled={isValidating && !isInitialLoading}
          >
            {isValidating && !isInitialLoading ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

export function TeamListSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}
