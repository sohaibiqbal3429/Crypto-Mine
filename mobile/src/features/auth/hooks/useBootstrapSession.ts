import { useEffect, useState } from 'react'
import { fetchCurrentUser } from '@/features/auth/api/login'
import { useSessionStore } from '@/store/useSessionStore'

export function useBootstrapSession() {
  const token = useSessionStore((state) => state.token)
  const setSession = useSessionStore((state) => state.setSession)
  const clearSession = useSessionStore((state) => state.clearSession)
  const [isLoading, setIsLoading] = useState(Boolean(token))

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const result = await fetchCurrentUser()
        if (!cancelled) {
          setSession(token, result.user)
        }
      } catch (error) {
        console.warn('Failed to refresh session', error)
        if (!cancelled) {
          clearSession()
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [token, setSession, clearSession])

  return { isLoading }
}
