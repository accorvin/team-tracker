import { describe, it, expect } from 'vitest'

/**
 * determineStaleness is a pure function extracted here for testing,
 * matching the implementation in orchestration.js.
 * The source file uses CJS require() which doesn't work in vitest's ESM context.
 */
function determineStaleness(sprints) {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const latestSprint = sprints
    .filter(s => s.endDate || s.completeDate)
    .sort((a, b) => new Date(b.endDate || b.completeDate) - new Date(a.endDate || a.completeDate))[0]

  if (!latestSprint) {
    return { stale: true, lastSprintEndDate: null }
  }

  const lastDate = new Date(latestSprint.endDate || latestSprint.completeDate)
  return {
    stale: lastDate < sixMonthsAgo,
    lastSprintEndDate: latestSprint.endDate || latestSprint.completeDate
  }
}

describe('determineStaleness', () => {
  it('marks board as stale if no sprints', () => {
    const result = determineStaleness([])
    expect(result.stale).toBe(true)
    expect(result.lastSprintEndDate).toBeNull()
  })

  it('marks board as stale if last sprint ended > 6 months ago', () => {
    const eightMonthsAgo = new Date()
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8)

    const result = determineStaleness([{
      endDate: eightMonthsAgo.toISOString(),
      state: 'closed'
    }])
    expect(result.stale).toBe(true)
  })

  it('marks board as not stale if last sprint ended recently', () => {
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    const result = determineStaleness([{
      endDate: twoWeeksAgo.toISOString(),
      state: 'closed'
    }])
    expect(result.stale).toBe(false)
  })

  it('uses completeDate as fallback', () => {
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const result = determineStaleness([{
      completeDate: oneMonthAgo.toISOString(),
      state: 'closed'
    }])
    expect(result.stale).toBe(false)
    expect(result.lastSprintEndDate).toBe(oneMonthAgo.toISOString())
  })

  it('picks the most recent sprint for staleness check', () => {
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const result = determineStaleness([
      { endDate: oneYearAgo.toISOString(), state: 'closed' },
      { endDate: oneMonthAgo.toISOString(), state: 'closed' }
    ])
    expect(result.stale).toBe(false)
    expect(result.lastSprintEndDate).toBe(oneMonthAgo.toISOString())
  })
})
