import { describe, it, expect } from 'vitest'

describe('GitHub TTL skip logic', () => {
  // Replicate the TTL skip logic from fetchGithubData for unit testing
  function partitionByTTL(usernames, existingData, ttlMs) {
    const now = Date.now()
    const toFetch = []
    const skipped = {}

    for (const username of usernames) {
      const existing = existingData[username]
      if (existing && existing.fetchedAt && (now - new Date(existing.fetchedAt).getTime()) < ttlMs) {
        skipped[username] = existing
      } else {
        toFetch.push(username)
      }
    }
    return { toFetch, skipped }
  }

  it('skips users within TTL', () => {
    const now = new Date().toISOString()
    const existingData = {
      'user1': { totalContributions: 42, fetchedAt: now },
      'user2': { totalContributions: 10, fetchedAt: now }
    }
    const ttlMs = 12 * 60 * 60 * 1000

    const { toFetch, skipped } = partitionByTTL(['user1', 'user2'], existingData, ttlMs)

    expect(toFetch).toEqual([])
    expect(skipped.user1.totalContributions).toBe(42)
    expect(skipped.user2.totalContributions).toBe(10)
  })

  it('fetches users outside TTL', () => {
    const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const existingData = {
      'stale-user': { totalContributions: 5, fetchedAt: oldDate }
    }
    const ttlMs = 12 * 60 * 60 * 1000

    const { toFetch, skipped } = partitionByTTL(['stale-user'], existingData, ttlMs)

    expect(toFetch).toEqual(['stale-user'])
    expect(Object.keys(skipped)).toHaveLength(0)
  })

  it('mixes fresh and stale users correctly', () => {
    const now = new Date().toISOString()
    const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const existingData = {
      'fresh': { totalContributions: 42, fetchedAt: now },
      'stale': { totalContributions: 5, fetchedAt: oldDate }
    }
    const ttlMs = 12 * 60 * 60 * 1000

    const { toFetch, skipped } = partitionByTTL(['fresh', 'stale'], existingData, ttlMs)

    expect(toFetch).toEqual(['stale'])
    expect(skipped.fresh.totalContributions).toBe(42)
  })

  it('fetches all users when TTL is 0 (force)', () => {
    const now = new Date().toISOString()
    const existingData = {
      'user1': { totalContributions: 42, fetchedAt: now }
    }

    const { toFetch, skipped } = partitionByTTL(['user1'], existingData, 0)

    expect(toFetch).toEqual(['user1'])
    expect(Object.keys(skipped)).toHaveLength(0)
  })

  it('fetches users with no existing data', () => {
    const { toFetch } = partitionByTTL(['new-user'], {}, 12 * 60 * 60 * 1000)
    expect(toFetch).toEqual(['new-user'])
  })

  it('fetches users with no fetchedAt in existing data', () => {
    const existingData = {
      'user1': { totalContributions: 42 }
    }

    const { toFetch } = partitionByTTL(['user1'], existingData, 12 * 60 * 60 * 1000)
    expect(toFetch).toEqual(['user1'])
  })
})

describe('GitHub monthly breakdown computation', () => {
  // Replicate the monthly bucketing logic from fetchGithubData
  function computeMonthsFromCalendar(calendar) {
    const months = {}
    for (const week of calendar.weeks || []) {
      for (const day of week.contributionDays || []) {
        const monthKey = day.date.slice(0, 7)
        months[monthKey] = (months[monthKey] || 0) + day.contributionCount
      }
    }
    return months
  }

  it('buckets daily contributions by month', () => {
    const calendar = {
      weeks: [
        {
          contributionDays: [
            { date: '2026-02-28', contributionCount: 5 },
            { date: '2026-03-01', contributionCount: 10 },
            { date: '2026-03-02', contributionCount: 3 }
          ]
        }
      ]
    }

    const months = computeMonthsFromCalendar(calendar)

    expect(months['2026-02']).toBe(5)
    expect(months['2026-03']).toBe(13)
  })

  it('handles empty weeks', () => {
    const months = computeMonthsFromCalendar({ weeks: [] })
    expect(months).toEqual({})
  })

  it('handles missing weeks field', () => {
    const months = computeMonthsFromCalendar({})
    expect(months).toEqual({})
  })
})
