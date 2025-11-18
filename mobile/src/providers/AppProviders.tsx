import { type PropsWithChildren, useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchIntervalInBackground: true
    }
  }
})

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active')
    })

    return () => {
      subscription.remove()
    }
  }, [])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
