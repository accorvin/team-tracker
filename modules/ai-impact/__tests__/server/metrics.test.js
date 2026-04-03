import { describe, it, expect } from 'vitest';
import { computeMetrics, buildTrendData, buildBreakdownData, computeAllMetrics, getRelevantDate } from '../../server/metrics.js';

function makeIssue(daysAgo, aiInvolvement = 'none', { createdLabelDate, revisedLabelDate } = {}) {
  const created = new Date();
  created.setDate(created.getDate() - daysAgo);
  return {
    key: `RFE-${Math.random().toString(36).slice(2, 6)}`,
    summary: 'Test',
    status: 'New',
    created: created.toISOString(),
    aiInvolvement,
    createdLabelDate: createdLabelDate || null,
    revisedLabelDate: revisedLabelDate || null
  };
}

describe('getRelevantDate', () => {
  it('returns created when no label dates exist', () => {
    const issue = { created: '2026-03-01T10:00:00Z', createdLabelDate: null, revisedLabelDate: null };
    expect(getRelevantDate(issue)).toBe('2026-03-01T10:00:00Z');
  });

  it('returns created when label date fields are missing (backward compat)', () => {
    const issue = { created: '2026-03-01T10:00:00Z' };
    expect(getRelevantDate(issue)).toBe('2026-03-01T10:00:00Z');
  });

  it('returns createdLabelDate when it is later than created', () => {
    const issue = {
      created: '2026-03-01T10:00:00Z',
      createdLabelDate: '2026-03-20T14:30:00Z',
      revisedLabelDate: null
    };
    expect(getRelevantDate(issue)).toBe('2026-03-20T14:30:00Z');
  });

  it('returns revisedLabelDate when it is the latest', () => {
    const issue = {
      created: '2026-03-01T10:00:00Z',
      createdLabelDate: '2026-03-10T10:00:00Z',
      revisedLabelDate: '2026-03-25T09:15:00Z'
    };
    expect(getRelevantDate(issue)).toBe('2026-03-25T09:15:00Z');
  });

  it('returns the latest of all dates', () => {
    const issue = {
      created: '2026-03-30T10:00:00Z',
      createdLabelDate: '2026-03-10T10:00:00Z',
      revisedLabelDate: '2026-03-20T10:00:00Z'
    };
    expect(getRelevantDate(issue)).toBe('2026-03-30T10:00:00Z');
  });
});

describe('computeMetrics', () => {
  it('computes percentages for "month" time window', () => {
    const issues = [
      makeIssue(5, 'created'),  // within month
      makeIssue(10, 'both'),    // within month
      makeIssue(15, 'none'),    // within month
      makeIssue(45, 'created'), // in prior period
      makeIssue(50, 'none'),    // in prior period
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    // Current: 3 issues, 2 with created (created + both) = 67%
    expect(result.createdPct).toBe(67);
    // Current: 3 issues, 1 with revised (both) = 33%
    expect(result.revisedPct).toBe(33);
    expect(result.windowTotal).toBe(3);
    expect(result.totalRFEs).toBe(5);
  });

  it('computes "week" time window', () => {
    const issues = [
      makeIssue(2, 'created'),
      makeIssue(3, 'revised'),
      makeIssue(5, 'none'),
    ];

    const result = computeMetrics(issues, 'week', { trendThresholdPp: 2 });

    expect(result.windowTotal).toBe(3);
    expect(result.createdPct).toBe(33);
    expect(result.revisedPct).toBe(33);
  });

  it('computes "3months" time window', () => {
    const issues = [
      makeIssue(10, 'both'),
      makeIssue(30, 'created'),
      makeIssue(60, 'revised'),
      makeIssue(85, 'none'),
    ];

    const result = computeMetrics(issues, '3months', { trendThresholdPp: 2 });

    expect(result.windowTotal).toBe(4);
  });

  it('classifies trend as growing when change > threshold', () => {
    const issues = [
      // Current period: 100% created
      makeIssue(5, 'created'),
      // Prior period: 0% created
      makeIssue(35, 'none'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('growing');
  });

  it('classifies trend as declining when change < -threshold', () => {
    const issues = [
      // Current period: 0% created
      makeIssue(5, 'none'),
      // Prior period: 100% created
      makeIssue(35, 'created'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('declining');
  });

  it('classifies trend as stable when change within threshold', () => {
    const issues = [
      makeIssue(5, 'created'),
      makeIssue(10, 'none'),
      makeIssue(35, 'created'),
      makeIssue(40, 'none'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('stable');
  });

  it('uses configurable threshold', () => {
    const issues = [
      makeIssue(5, 'created'),
      makeIssue(10, 'created'),
      makeIssue(15, 'none'),
      // Prior: all none
      makeIssue(35, 'none'),
      makeIssue(40, 'none'),
      makeIssue(45, 'none'),
    ];

    // With high threshold, same data is "stable"
    const highThreshold = computeMetrics(issues, 'month', { trendThresholdPp: 90 });
    expect(highThreshold.trend).toBe('stable');
  });

  it('handles empty issues', () => {
    const result = computeMetrics([], 'month', { trendThresholdPp: 2 });

    expect(result.createdPct).toBe(0);
    expect(result.revisedPct).toBe(0);
    expect(result.windowTotal).toBe(0);
    expect(result.totalRFEs).toBe(0);
    expect(result.trend).toBe('stable');
  });

  it('handles all same category', () => {
    const issues = [
      makeIssue(5, 'both'),
      makeIssue(10, 'both'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.createdPct).toBe(100);
    expect(result.revisedPct).toBe(100);
  });

  it('uses default threshold of 2 when config is null', () => {
    const result = computeMetrics([], 'month', null);
    expect(result.trend).toBe('stable');
  });

  it('includes old issue in window when label was recently added', () => {
    // Issue created 60 days ago, but label added 5 days ago
    const labelDate = new Date();
    labelDate.setDate(labelDate.getDate() - 5);
    const issues = [
      makeIssue(60, 'created', { createdLabelDate: labelDate.toISOString() }),
      makeIssue(5, 'none'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    // Both issues should be in the window (label date pulls old issue in)
    expect(result.windowTotal).toBe(2);
    expect(result.createdPct).toBe(50);
    // Percentage must be <= 100%
    expect(result.createdPct).toBeLessThanOrEqual(100);
  });

  it('old cached data without label date fields falls back to created', () => {
    const created = new Date();
    created.setDate(created.getDate() - 5);
    const issues = [{
      key: 'RFE-old',
      summary: 'Old cached',
      status: 'New',
      created: created.toISOString(),
      aiInvolvement: 'created'
      // No createdLabelDate or revisedLabelDate fields
    }];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });
    expect(result.windowTotal).toBe(1);
    expect(result.createdPct).toBe(100);
  });
});

describe('buildTrendData', () => {
  it('returns correct number of weeks for each window', () => {
    expect(buildTrendData([], 'week')).toHaveLength(4);
    expect(buildTrendData([], 'month')).toHaveLength(8);
    expect(buildTrendData([], '3months')).toHaveLength(13);
  });

  it('buckets issues by week', () => {
    const issues = [
      makeIssue(1, 'created'),
      makeIssue(2, 'both'),
      makeIssue(10, 'none'),
    ];

    const points = buildTrendData(issues, 'month');

    // Last point should include the recent issues
    const lastPoint = points[points.length - 1];
    expect(lastPoint.total).toBeGreaterThan(0);
    expect(lastPoint.date).toBeTruthy();
  });

  it('computes per-week percentages correctly', () => {
    // All issues in the same recent week
    const issues = [
      makeIssue(1, 'created'),
      makeIssue(2, 'created'),
      makeIssue(3, 'none'),
      makeIssue(3, 'none'),
    ];

    const points = buildTrendData(issues, 'week');

    // Find the point that has these issues
    const withData = points.find(p => p.total === 4);
    if (withData) {
      expect(withData.createdPct).toBe(50);
    }
  });

  it('returns 0 for weeks with no issues', () => {
    const points = buildTrendData([], 'week');
    for (const p of points) {
      expect(p.createdPct).toBe(0);
      expect(p.revisedPct).toBe(0);
      expect(p.total).toBe(0);
    }
  });

  it('counts label-added issues in the correct week bucket', () => {
    // Issue created 60 days ago, label added 3 days ago → should appear in recent week
    const labelDate = new Date();
    labelDate.setDate(labelDate.getDate() - 3);
    const issues = [
      makeIssue(60, 'revised', { revisedLabelDate: labelDate.toISOString() }),
    ];

    const points = buildTrendData(issues, 'month');
    const lastPoint = points[points.length - 1];
    // The issue should be bucketed in the most recent week (by label date, not created)
    expect(lastPoint.total).toBe(1);
    expect(lastPoint.revisedPct).toBe(100);
  });
});

describe('buildBreakdownData', () => {
  it('counts by AI involvement category', () => {
    const issues = [
      makeIssue(1, 'both'),
      makeIssue(2, 'both'),
      makeIssue(3, 'created'),
      makeIssue(4, 'revised'),
      makeIssue(5, 'none'),
      makeIssue(6, 'none'),
      makeIssue(7, 'none'),
    ];

    const result = buildBreakdownData(issues);

    expect(result).toEqual([
      { name: 'Created & Revised', value: 2 },
      { name: 'AI Created', value: 1 },
      { name: 'AI Revised', value: 1 },
      { name: 'No AI', value: 3 },
    ]);
  });

  it('handles empty issues', () => {
    const result = buildBreakdownData([]);
    expect(result).toEqual([
      { name: 'Created & Revised', value: 0 },
      { name: 'AI Created', value: 0 },
      { name: 'AI Revised', value: 0 },
      { name: 'No AI', value: 0 },
    ]);
  });
});

describe('computeAllMetrics', () => {
  it('returns metrics, trendData, and breakdown', () => {
    const issues = [makeIssue(5, 'created')];
    const result = computeAllMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('trendData');
    expect(result).toHaveProperty('breakdown');
    expect(result.trendData).toHaveLength(8);
  });
});
