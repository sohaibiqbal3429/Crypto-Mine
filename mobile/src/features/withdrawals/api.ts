import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api'
import { REALTIME_REFETCH_INTERVAL_MS } from '@/utils/env'
import type { WithdrawalHistoryResponse } from './types/withdrawals'

export interface WithdrawalsQueryVariables {
  page?: number
  limit?: number
}

export function fetchWithdrawals(variables: WithdrawalsQueryVariables = {}): Promise<WithdrawalHistoryResponse> {
  return apiClient.get<WithdrawalHistoryResponse>('/api/wallet/withdraw-history', {
    page: variables.page ?? 1,
    limit: variables.limit ?? 20
  })
}

export function useWithdrawalsQuery(variables: WithdrawalsQueryVariables = {}) {
  return useQuery({
    queryKey: ['withdrawals', variables],
    queryFn: () => fetchWithdrawals(variables),
    refetchInterval: REALTIME_REFETCH_INTERVAL_MS,
    staleTime: REALTIME_REFETCH_INTERVAL_MS / 2,
    retry: 1
  })
}
