import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let useBackendHealth, _resetForTesting

describe('useBackendHealth', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    // Fresh import each test to reset module state
    vi.resetModules()
    const mod = await import('@shared/client/composables/useBackendHealth')
    useBackendHealth = mod.useBackendHealth
    _resetForTesting = mod._resetForTesting
    _resetForTesting()
  })

  afterEach(() => {
    _resetForTesting()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts with backend assumed connected', () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    const { isBackendDown, isExtendedOutage } = useBackendHealth()
    expect(isBackendDown.value).toBe(false)
    expect(isExtendedOutage.value).toBe(false)
  })

  it('does not mark backend down after a single failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const { isBackendDown } = useBackendHealth()
    // First check runs on init
    await vi.advanceTimersByTimeAsync(0)
    expect(isBackendDown.value).toBe(false)
  })

  it('marks backend down after 2 consecutive failures', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const { isBackendDown } = useBackendHealth()
    // First check (init)
    await vi.advanceTimersByTimeAsync(0)
    // Second check (after interval)
    await vi.advanceTimersByTimeAsync(5000)
    expect(isBackendDown.value).toBe(true)
  })

  it('recovers when backend responds OK', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const { isBackendDown } = useBackendHealth()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(isBackendDown.value).toBe(true)

    // Backend comes back
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    await vi.advanceTimersByTimeAsync(5000)
    expect(isBackendDown.value).toBe(false)
  })

  it('shows extended outage after 2 minutes', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const { isBackendDown, isExtendedOutage } = useBackendHealth()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(isBackendDown.value).toBe(true)
    expect(isExtendedOutage.value).toBe(false)

    // Advance 2 minutes
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    expect(isExtendedOutage.value).toBe(true)
  })

  it('resets extended outage flag on recovery', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const { isBackendDown, isExtendedOutage } = useBackendHealth()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5000)
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    expect(isExtendedOutage.value).toBe(true)

    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    await vi.advanceTimersByTimeAsync(5000)
    expect(isBackendDown.value).toBe(false)
    expect(isExtendedOutage.value).toBe(false)
  })

  it('treats non-OK HTTP response as failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    const { isBackendDown } = useBackendHealth()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(isBackendDown.value).toBe(true)
  })
})
