export interface ApiClientConfig {
  baseUrl: string
  getToken?: () => string | null
}

export interface RequestOptions extends RequestInit {
  path: string
  query?: Record<string, string | number | boolean | undefined>
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly getToken?: () => string | null

  constructor({ baseUrl, getToken }: ApiClientConfig) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.getToken = getToken
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const url = new URL(`${this.baseUrl}${normalizedPath}`)

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (typeof value === 'undefined' || value === null) {
          return
        }
        url.searchParams.set(key, String(value))
      })
    }

    return url.toString()
  }

  async request<T>({ path, query, headers, ...init }: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, query)
    const token = this.getToken?.()

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {})
      }
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `Request failed with status ${response.status}`)
    }

    if (response.status === 204) {
      return undefined as T
    }

    const text = await response.text()
    if (!text) {
      return undefined as T
    }

    try {
      return JSON.parse(text) as T
    } catch (error) {
      console.error('Failed to parse response JSON', error)
      throw new Error('Malformed response received from API')
    }
  }

  get<T>(path: string, query?: RequestOptions['query']): Promise<T> {
    return this.request<T>({ method: 'GET', path, query })
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: 'POST', path, body: body ? JSON.stringify(body) : undefined })
  }
}
