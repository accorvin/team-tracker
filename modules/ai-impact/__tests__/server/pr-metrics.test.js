import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computePRMetrics } from '../../server/pr-metrics.js';

function makePR(overrides) {
  return {
    state: 'merged',
    createdAt: '2026-04-01T10:00:00Z',
    mergedAt: '2026-04-02T10:00:00Z',
    closedAt: null,
    updatedAt: '2026-04-02T10:00:00Z',
    cycleTimeHours: 24,
    additions: 100,
    deletions: 50,
    sizeBucket: 'M',
    aiThreads: { resolved: 0, total: 0 },
    totalReviewThreads: 2,
    ...overrides
  };
}

describe('computePRMetrics – medianLinesChanged in trendData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes medianLinesChanged for weeks with merged PRs', () => {
    const prs = [
      makePR({ mergedAt: '2026-04-14T10:00:00Z', additions: 100, deletions: 50 }),
      makePR({ mergedAt: '2026-04-15T10:00:00Z', additions: 200, deletions: 100 }),
      makePR({ mergedAt: '2026-04-13T10:00:00Z', additions: 20, deletions: 10 }),
    ];

    const result = computePRMetrics(prs, 'month');
    const lastWeek = result.trendData[result.trendData.length - 1];

    expect(lastWeek.medianLinesChanged).toBe(150);
  });

  it('returns null for weeks with no merged PRs', () => {
    const prs = [
      makePR({ state: 'open', mergedAt: null, createdAt: '2026-04-10T10:00:00Z' }),
    ];

    const result = computePRMetrics(prs, 'month');
    const emptyWeeks = result.trendData.filter(w => w.mergedCount === 0);

    for (const week of emptyWeeks) {
      expect(week.medianLinesChanged).toBeNull();
    }
  });

  it('handles a single merged PR in a week (median = that value)', () => {
    const prs = [
      makePR({ mergedAt: '2026-04-15T10:00:00Z', additions: 40, deletions: 10 }),
    ];

    const result = computePRMetrics(prs, 'month');
    const weekWithPR = result.trendData.find(w => w.mergedCount === 1);

    expect(weekWithPR).toBeDefined();
    expect(weekWithPR.medianLinesChanged).toBe(50);
  });

  it('uses additions + deletions as total lines changed', () => {
    const prs = [
      makePR({ mergedAt: '2026-04-14T10:00:00Z', additions: 0, deletions: 80 }),
      makePR({ mergedAt: '2026-04-14T12:00:00Z', additions: 120, deletions: 0 }),
    ];

    const result = computePRMetrics(prs, 'month');
    const weekWithPRs = result.trendData.find(w => w.mergedCount === 2);

    expect(weekWithPRs).toBeDefined();
    expect(weekWithPRs.medianLinesChanged).toBe(100);
  });

  it('every trendData entry has the medianLinesChanged field', () => {
    const prs = [makePR({ mergedAt: '2026-04-15T10:00:00Z' })];
    const result = computePRMetrics(prs, 'month');

    for (const week of result.trendData) {
      expect(week).toHaveProperty('medianLinesChanged');
    }
  });
});
