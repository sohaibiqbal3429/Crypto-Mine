import { apiClient } from '@/api'
import { REALTIME_REFETCH_INTERVAL_MS } from '@/utils/env'
import { useQuery } from '@tanstack/react-query'
import type { DashboardResponse } from './types/dashboard'

export function fetchDashboard(): Promise<DashboardResponse> {
  return apiClient.get<DashboardResponse>('/api/dashboard')
}

export function useDashboardQuery() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: REALTIME_REFETCH_INTERVAL_MS,
    staleTime: REALTIME_REFETCH_INTERVAL_MS / 2,
    retry: 1
  })
}
