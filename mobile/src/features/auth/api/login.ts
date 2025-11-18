import { apiClient } from '@/api'
import type { AuthUser } from '@/store/useSessionStore'

export interface LoginPayload {
  identifier: string
  identifierType: 'email' | 'phone'
  password: string
}

interface LoginResponse {
  success: boolean
  user: AuthUser
  token?: string
  blocked?: boolean
  error?: string
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>('/api/auth/login', payload)
}

export async function fetchCurrentUser(): Promise<{ user: AuthUser }> {
  return apiClient.get<{ user: AuthUser }>('/api/auth/me')
}
