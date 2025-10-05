"use client"

import { useEffect, useId, useMemo, useState } from "react"

import { type CountdownSegment, type LaunchPhase } from "@/hooks/use-launch-countdown"
import { cn } from "@/lib/utils"

interface CountdownDisplayProps {
  segments: CountdownSegment[]
  phase: LaunchPhase
}

function useLocalizedLabel(unit: CountdownSegment["unit"]) {
  const locale = useMemo(() => {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language
    }
    if (typeof Intl !== "undefined") {
      return Intl.DateTimeFormat().resolvedOptions().locale
    }
    return "en-US"
  }, [])

  return useMemo(() => {
    const singular = unit === "days" ? "day" : unit === "hours" ? "hour" : unit === "minutes" ? "minute" : "second"

      if (typeof Intl.DisplayNames === "function") {
        try {
          const formatter = new Intl.DisplayNames([locale], { type: "unit" })
          return formatter.of(singular) ?? singular
        } catch (error) {
          return singular
        }
      }

    return singular
  }, [locale, unit])
}

interface CountdownTileProps {
  segment: CountdownSegment
}

function CountdownTile({ segment }: CountdownTileProps) {
  const [isFlipping, setIsFlipping] = useState(false)
  const label = useLocalizedLabel(segment.unit)
  const labelId = useId()

  useEffect(() => {
    setIsFlipping(true)
    const timeout = window.setTimeout(() => {
      setIsFlipping(false)
    }, 220)
    return () => window.clearTimeout(timeout)
  }, [segment.value])

  return (
    <div
      aria-labelledby={labelId}
      className={cn(
        "flex w-full flex-col items-center gap-1 rounded-2xl border border-border/60 bg-background/90 p-4 text-center shadow-[0_14px_35px_rgba(15,23,42,0.08)] transition-shadow duration-[var(--t-med)] ease-[var(--ease)]", // tile styling
        "backdrop-blur-sm",
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-16 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-background via-background to-muted text-5xl font-semibold tabular-nums text-foreground transition-[transform,opacity] duration-[var(--t-med)] ease-[var(--ease)] sm:text-6xl",
          isFlipping ? "opacity-75 motion-safe:-translate-y-1" : "opacity-100 motion-safe:translate-y-0",
        )}
        aria-live="off"
      >
        {segment.value.toString().padStart(2, "0")}
      </span>
      <span
        id={labelId}
        className="text-[0.7rem] font-semibold uppercase tracking-[0.4em] text-muted-foreground"
      >
        {label.toUpperCase()}
      </span>
    </div>
  )
}

export function CountdownDisplay({ segments, phase }: CountdownDisplayProps) {
  return (
    <div
      className={cn(
        "grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4",
        phase === "live" ? "opacity-60" : "opacity-100",
      )}
      aria-live="polite"
    >
      {segments.map((segment) => (
        <CountdownTile key={segment.unit} segment={segment} />
      ))}
    </div>
  )
}

interface CountdownBadgeProps {
  segments: CountdownSegment[]
  phase: LaunchPhase
}

export function CountdownBadge({ segments, phase }: CountdownBadgeProps) {
  if (phase === "live") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500 shadow-sm">
        LIVE
      </span>
    )
  }

  const formatted = segments
    .map((segment) => `${segment.value.toString().padStart(2, "0")} ${segment.unit.slice(0, 1).toUpperCase()}`)
    .join(" · ")

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary shadow-sm">
      {formatted}
    </span>
  )
}
