"use client"

interface SidebarProps {
  user?: {
    name: string
    email: string
    referralCode: string
    role?: string
    profileAvatar?: string
  }
}

export function Sidebar({ user }: SidebarProps) {
  void user
  return null
}
