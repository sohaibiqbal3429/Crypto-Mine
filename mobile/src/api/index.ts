import { ApiClient } from './client'
import { API_BASE_URL } from '@/utils/env'
import { useSessionStore } from '@/store/useSessionStore'

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getToken: () => useSessionStore.getState().token
})
