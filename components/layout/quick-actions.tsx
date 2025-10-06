"use client"

import { useState } from "react"
import Link from "next/link"
import { Bolt, CreditCard, HelpCircle, History, Send, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface QuickAction {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

const quickActions: QuickAction[] = [
  {
    href: "/wallet/deposit",
    label: "Submit deposit receipt",
    description: "Upload proof of your latest transfer",
    icon: CreditCard,
  },
  {
    href: "/transactions",
    label: "Review transactions",
    description: "Check deposit and withdrawal history",
    icon: History,
  },
  {
    href: "/support",
    label: "Contact support",
    description: "Get help from the Mintmine Pro team",
    icon: HelpCircle,
  },
  {
    href: "/tasks",
    label: "Claim daily rewards",
    description: "Complete quick actions to boost earnings",
    icon: Send,
  },
]

export function QuickActions() {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open quick actions"
          className="rounded-full border border-border/80 bg-background/80 shadow-sm backdrop-blur"
        >
          <Bolt className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={12} className="w-80 p-0">
        <div className="border-b px-4 pb-3 pt-4">
          <h3 className="text-sm font-semibold text-foreground">Quick actions</h3>
          <p className="text-xs text-muted-foreground">Jump straight to the most common tasks in Mintmine Pro.</p>
        </div>
        <div className="flex flex-col gap-1 p-2">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setOpen(false)}
              className="group flex items-start gap-3 rounded-md px-3 py-2 text-left transition hover:bg-muted/80"
            >
              <action.icon className="mt-0.5 h-4 w-4 text-primary transition group-hover:scale-110" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none text-foreground">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
