"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import { MonitorCog, MoonStar, RefreshCw, Sparkles, Sun } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const themeOptions = [
  {
    id: "system",
    label: "System",
    description: "Auto-switch with OS",
    icon: MonitorCog,
    value: "system",
  },
  {
    id: "light",
    label: "Light",
    description: "Bright trading floor",
    icon: Sun,
    value: "light",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Midnight miner",
    icon: MoonStar,
    value: "dark",
  },
] as const

export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const menuId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = useMemo(() => (resolvedTheme ?? theme ?? "system"), [resolvedTheme, theme])

  useEffect(() => {
    if (!open) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  const overlay = mounted && open
    ? createPortal(
        <div
          className="fixed inset-0 z-[calc(var(--z-dropdown,900)-1)] bg-background/20 backdrop-blur-[1.5px]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />,
        document.body,
      )
    : null

  return (
    <>
      {overlay}
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open quick actions"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            className={cn(
              "relative flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background/70 shadow-sm transition-all duration-[var(--t-fast,180ms)] ease-[var(--ease)]",
              "hover:-translate-y-[2px] hover:shadow-[0_12px_24px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            )}
          >
            <Sun
              className={cn(
                "h-5 w-5 transition-transform duration-[var(--t-med,240ms)] ease-[var(--ease)]",
                activeTheme === "dark" ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
              )}
            />
            <MoonStar
              className={cn(
                "absolute h-5 w-5 transition-transform duration-[var(--t-med,240ms)] ease-[var(--ease)]",
                activeTheme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0",
              )}
            />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          id={menuId}
          align="end"
          sideOffset={12}
          className={cn(
            "popover w-[min(20rem,90vw)] rounded-2xl border border-border/70 bg-background/95 p-4 shadow-xl shadow-black/10 backdrop-blur-lg",
            open && "open",
          )}
          style={{ position: "fixed" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Quick actions</p>
              <p className="text-xs text-muted-foreground">Theme, refresh &amp; live status</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-primary">
              UI
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Theme selection">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isActive = activeTheme === option.value
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "group flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/70 text-center transition-all duration-[var(--t-med,240ms)] ease-[var(--ease)]",
                    "hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_12px_28px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isActive ? "border-primary/60 bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-[0.3em]">{option.label}</span>
                  <span className="text-[0.65rem] text-muted-foreground">{option.description}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 space-y-3" role="group" aria-label="Utilities">
            <button
              type="button"
              onClick={() => {
                router.refresh()
                setOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-left text-sm transition-all duration-[var(--t-med,240ms)] ease-[var(--ease)] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <div>
                <p className="font-semibold text-foreground">Refresh data</p>
                <p className="text-xs text-muted-foreground">Revalidate dashboards &amp; balances</p>
              </div>
              <RefreshCw className="h-4 w-4 text-primary" aria-hidden="true" />
            </button>

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Launch status</p>
                <p className="text-xs text-muted-foreground">Auto-updates with countdown</p>
              </div>
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
