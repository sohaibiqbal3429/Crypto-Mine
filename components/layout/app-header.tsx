"use client"

import { QuickActions } from "@/components/layout/quick-actions"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"

export function AppHeader() {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[var(--z-header)] flex w-full justify-end px-2 sm:right-6 sm:top-6">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-2 py-1.5 shadow-lg shadow-black/5 backdrop-blur">
        <QuickActions />
        <span className="h-5 w-px bg-border/60" aria-hidden />
        <NotificationBell />
        <span className="h-5 w-px bg-border/60" aria-hidden />
        <ThemeToggle />
      </div>
    </div>
  )
}
