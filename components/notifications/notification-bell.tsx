"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useIsMobile } from "@/components/ui/use-mobile"
import { Bell, CheckCheck, X } from "lucide-react"

interface Notification {
  _id: string
  kind: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications?limit=10")
      if (response.ok) {
        const data = await response.json()
        const list = Array.isArray(data.notifications) ? data.notifications : []
        setNotifications(list)
        setUnreadCount(list.reduce((acc: number, n: any) => acc + (n?.read ? 0 : 1), 0))
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => (notif._id === notificationId ? { ...notif, read: true } : notif)),
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      })

      if (response.ok) {
        setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error)
    } finally {
      setLoading(false)
    }
  }

  const getNotificationIcon = (kind: string) => {
    switch (kind) {
      case "referral-joined":
        return "👥"
      case "deposit-approved":
        return "💰"
      case "withdraw-approved":
        return "💸"
      case "withdraw-requested":
        return "📝"
      case "withdraw-cancelled":
        return "↩️"
      case "level-up":
        return "🎉"
      case "cap-reached":
        return "⚠️"
      case "mining-reward":
        return "⛏️"
      default:
        return "📢"
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const renderBellButton = (buttonProps?: React.ComponentProps<typeof Button>) => (
    <Button
      variant="ghost"
      size="icon"
      className="group relative rounded-full bg-card/50 text-foreground shadow-[0_10px_30px_-16px_rgba(109,40,217,0.55)] backdrop-blur"
      aria-label="Open notifications"
      {...buttonProps}
    >
      <span className="absolute inset-0 rounded-full bg-primary/10 opacity-0 transition group-hover:opacity-100" aria-hidden />
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <>
          <span className="absolute inset-0 animate-pulse rounded-full bg-primary/15 blur-[1px]" aria-hidden />
          <span
            className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground shadow-sm ring-2 ring-white/50"
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        </>
      )}
    </Button>
  )

  const Header = ({ onClose }: { onClose: () => void }) => (
    <div className="flex items-start justify-between gap-3 pb-2">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-muted-foreground dark:text-secondary-dark">Notifications</p>
        <p className="text-xs text-muted-foreground/80 dark:text-muted-dark">Quick updates, kept compact.</p>
      </div>
      <div className="flex items-center gap-2">
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            disabled={loading}
            className="rounded-full border border-border/60 bg-white/60 text-xs font-semibold shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10"
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Mark all
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full border border-border/60 bg-white/60 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10"
          aria-label="Close notifications"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const NotificationItems = ({ onItemSelect }: { onItemSelect?: () => void }) => (
    <div className="space-y-3">
      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-6 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-secondary-dark">
          No notifications yet
        </div>
      ) : (
        notifications.map((notification) => (
          <button
            key={notification._id}
            type="button"
            className={`group relative w-full overflow-hidden rounded-2xl border p-3 text-left backdrop-blur transition hover:-translate-y-[1px] hover:shadow-xl ${
              !notification.read
                ? "border-primary/30 bg-white/80 shadow-[0_18px_40px_-22px_rgba(99,102,241,0.65)] dark:border-primary/40 dark:bg-white/10"
                : "border-border/60 bg-white/60 shadow-sm dark:border-white/5 dark:bg-white/5"
            }`}
            onClick={() => {
              if (!notification.read) {
                void markAsRead(notification._id)
              }
              onItemSelect?.()
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-cyan-400/10 opacity-0 transition group-hover:opacity-100" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">
                {getNotificationIcon(notification.kind)}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground dark:text-primary-dark">{notification.title}</p>
                  <span className="text-[11px] text-muted-foreground dark:text-muted-dark whitespace-nowrap">{formatTimeAgo(notification.createdAt)}</span>
                </div>
                <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground dark:text-secondary-dark">
                  {notification.body}
                </p>
                <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground dark:text-muted-dark">
                  <div className="flex items-center gap-1">
                    {!notification.read && (
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary dark:bg-white/15 dark:text-inverse-dark"
                      >
                        New
                      </Badge>
                    )}
                    {notification.kind ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-border/70 bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-white/10 dark:bg-white/0 dark:text-secondary-dark"
                      >
                        {notification.kind.replace("-", " ")}
                      </Badge>
                    ) : null}
                  </div>
                  {notification.body.length > 120 && (
                    <span className="font-semibold text-primary transition hover:text-primary/80">Learn more</span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  )

  const panelContent = (
    <div className="space-y-3">
      <Header onClose={() => setOpen(false)} />
      <ScrollArea className={`${isMobile ? "max-h-[55vh]" : "max-h-[45vh]"} pr-1`}>
        <NotificationItems onItemSelect={() => isMobile && setOpen(false)} />
      </ScrollArea>
    </div>
  )

  if (isMobile) {
    return (
      <>
        {renderBellButton({ onClick: () => setOpen(true) })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="px-4 pb-5 pt-3 sm:px-6">
            <div className="mx-auto mb-3 mt-1 h-1.5 w-14 rounded-full bg-white/40" />
            <Header onClose={() => setOpen(false)} />
            <ScrollArea className="max-h-[60vh] pr-1 pt-2">
              <NotificationItems onItemSelect={() => setOpen(false)} />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{renderBellButton()}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={10}
        alignOffset={-4}
        className="notification-panel rounded-3xl border border-white/40 bg-white/80 p-4 text-foreground shadow-[0_30px_55px_-30px_rgba(59,130,246,0.55)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/70 dark:border-white/10 dark:bg-slate-950/70"
      >
        {panelContent}
      </PopoverContent>
    </Popover>
  )
}
