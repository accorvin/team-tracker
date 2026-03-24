import { describe, it, expect } from 'vitest'
import { formatPercent, formatNumber, formatDate, getMonthKey, formatMonthLabel, aggregateToMonthlyBuckets } from '../../client/utils/metrics'

describe('formatPercent', () => {
  it('formats number as percentage', () => {
    expect(formatPercent(85.7)).toBe('86%')
    expect(formatPercent(100)).toBe('100%')
    expect(formatPercent(0)).toBe('0%')
  })

  it('returns -- for null/undefined', () => {
    expect(formatPercent(null)).toBe('--')
    expect(formatPercent(undefined)).toBe('--')
  })
})

describe('formatNumber', () => {
  it('formats numbers', () => {
    expect(formatNumber(42)).toBe('42')
    expect(formatNumber(3.14159, 2)).toBe('3.14')
  })

  it('returns -- for null', () => {
    expect(formatNumber(null)).toBe('--')
  })
})

describe('formatDate', () => {
  it('formats date strings', () => {
    const result = formatDate('2026-01-15T12:00:00.000Z')
    expect(result).toContain('Jan')
    expect(result).toContain('2026')
  })

  it('returns -- for null', () => {
    expect(formatDate(null)).toBe('--')
  })
})

describe('getMonthKey', () => {
  it('returns YYYY-MM format', () => {
    expect(getMonthKey('2026-01-15T00:00:00.000Z')).toBe('2026-01')
    expect(getMonthKey('2026-12-31T00:00:00.000Z')).toBe('2026-12')
  })
})

describe('formatMonthLabel', () => {
  it('formats month key as label', () => {
    expect(formatMonthLabel('2026-01')).toBe('Jan 2026')
    expect(formatMonthLabel('2026-12')).toBe('Dec 2026')
  })
})

describe('aggregateToMonthlyBuckets', () => {
  it('aggregates sprint data into monthly buckets', () => {
    const sprints = [
      { endDate: '2026-01-10', velocityPoints: 20, velocityCount: 5, committedPoints: 25, deliveredPoints: 20 },
      { endDate: '2026-01-24', velocityPoints: 15, velocityCount: 4, committedPoints: 20, deliveredPoints: 15 },
      { endDate: '2026-02-07', velocityPoints: 30, velocityCount: 8, committedPoints: 35, deliveredPoints: 30 }
    ]

    const buckets = aggregateToMonthlyBuckets(sprints)

    expect(buckets).toHaveLength(2)
    expect(buckets[0].month).toBe('2026-01')
    expect(buckets[0].velocityPoints).toBe(35) // 20 + 15
    expect(buckets[0].sprintCount).toBe(2)
    expect(buckets[1].month).toBe('2026-02')
    expect(buckets[1].velocityPoints).toBe(30)
  })

  it('handles empty array', () => {
    expect(aggregateToMonthlyBuckets([])).toEqual([])
  })

  it('skips entries without endDate', () => {
    const sprints = [
      { velocityPoints: 10 },
      { endDate: '2026-03-01', velocityPoints: 20, velocityCount: 5, committedPoints: 25, deliveredPoints: 20 }
    ]
    const buckets = aggregateToMonthlyBuckets(sprints)
    expect(buckets).toHaveLength(1)
  })
})
