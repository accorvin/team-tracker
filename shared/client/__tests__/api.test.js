import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getApiBase', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to /api when VITE_API_ENDPOINT is unset', async () => {
    vi.stubEnv('VITE_API_ENDPOINT', undefined)
    const { getApiBase } = await import('../services/api.js')
    expect(getApiBase()).toBe('/api')
  })

  it('appends /api for bare origin URLs', async () => {
    vi.stubEnv('VITE_API_ENDPOINT', 'http://localhost:3001')
    const { getApiBase } = await import('../services/api.js')
    expect(getApiBase()).toBe('http://localhost:3001/api')
  })

  it('does not double-append when path already includes /api', async () => {
    vi.stubEnv('VITE_API_ENDPOINT', 'http://localhost:3001/api')
    const { getApiBase } = await import('../services/api.js')
    expect(getApiBase()).toBe('http://localhost:3001/api')
  })
})
