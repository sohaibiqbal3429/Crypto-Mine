import { create } from 'zustand'

export interface AuthUser {
  id: string
  name: string
  email: string
  role?: string
  referralCode?: string
}

interface SessionState {
  token: string | null
  user: AuthUser | null
  setSession: (token: string, user: AuthUser) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  token: null,
  user: null,
  setSession: (token, user) => set({ token, user }),
  clearSession: () => set({ token: null, user: null })
}))
