import { ApiClient } from '@/api/client'

describe('ApiClient', () => {
  it('builds a GET request with query params and token header', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
        headers: { get: () => 'application/json' }
      })

    const client = new ApiClient({ baseUrl: 'https://example.com', getToken: () => 'token-123' })

    await client.get('/api/dashboard', { page: 2 })

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/dashboard?page=2', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token-123' })
    }))

    fetchMock.mockRestore()
  })
})
