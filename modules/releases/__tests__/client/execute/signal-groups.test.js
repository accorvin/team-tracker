import { describe, it, expect } from 'vitest';
import {
  categorizeFeatures,
  effectiveHealth,
  isFeatureCompleteForSignals,
  signalIdForFeature,
  summarizeSignalFeatures
} from '../../../client/execute/helpers/signal-groups';

describe('signalIdForFeature', function () {
  it('returns complete for 100% completion', function () {
    expect(signalIdForFeature({ completionPct: 100, health: 'GREEN' })).toBe('complete')
  })

  it('returns blocked for RED health with blockers', function () {
    expect(signalIdForFeature({ completionPct: 40, health: 'RED', blockerCount: 1 })).toBe('blocked')
  })

  it('returns at-risk for YELLOW in progress', function () {
    expect(signalIdForFeature({
      completionPct: 20,
      health: 'YELLOW',
      statusCategory: 'In Progress'
    })).toBe('at-risk')
  })
})

function findGroup(groups, id) {
  return groups.find(g => g.id === id);
}

function groupIds(groups) {
  return groups.map(g => g.id);
}

describe('effectiveHealth', () => {
  it('returns pipeline health when present', () => {
    expect(effectiveHealth({ health: 'RED' })).toBe('RED');
    expect(effectiveHealth({ health: 'GREEN' })).toBe('GREEN');
    expect(effectiveHealth({ health: 'YELLOW' })).toBe('YELLOW');
  });

  it('infers GREEN from Jira In Progress when health is null', () => {
    expect(effectiveHealth({ health: null, statusCategory: 'In Progress' })).toBe('GREEN');
  });

  it('defaults to YELLOW when health is null and statusCategory is To Do', () => {
    expect(effectiveHealth({ health: null, statusCategory: 'To Do' })).toBe('YELLOW');
  });

  it('defaults to YELLOW when health is null and no statusCategory', () => {
    expect(effectiveHealth({ health: null })).toBe('YELLOW');
    expect(effectiveHealth({})).toBe('YELLOW');
  });
});

describe('categorizeFeatures', () => {
  it('places 100% completion features in complete', () => {
    const features = [
      { key: 'F-1', completionPct: 100, health: 'GREEN', statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'complete').features).toHaveLength(1);
  });

  it('places Jira Done features in complete regardless of pipeline health', () => {
    const features = [
      { key: 'F-1', completionPct: 98, health: 'RED', statusCategory: 'Done', blockerCount: 0 },
      { key: 'F-2', completionPct: 50, health: 'YELLOW', statusCategory: 'Done', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    const complete = findGroup(groups, 'complete');
    expect(complete.features).toHaveLength(2);
    expect(complete.features.map(f => f.key)).toEqual(['F-1', 'F-2']);
  });

  it('does not place Jira Done features in needs-attention even with RED health', () => {
    const features = [
      { key: 'F-1', completionPct: 91, health: 'RED', statusCategory: 'Done', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'red-other')).toBeUndefined();
    expect(findGroup(groups, 'complete').features).toHaveLength(1);
  });

  it('places RED health features with blockers in blocked', () => {
    const features = [
      { key: 'F-1', completionPct: 50, health: 'RED', statusCategory: 'In Progress', blockerCount: 3 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'blocked').features).toHaveLength(1);
  });

  it('places RED health features without blockers in needs-attention', () => {
    const features = [
      { key: 'F-1', completionPct: 50, health: 'RED', statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'red-other').features).toHaveLength(1);
  });

  it('does not place Jira In Progress features in not-started even with 0% completion', () => {
    const features = [
      { key: 'F-1', completionPct: 0, health: 'YELLOW', statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'not-started')).toBeUndefined();
    expect(findGroup(groups, 'at-risk').features).toHaveLength(1);
  });

  it('places To Do features with 0% in not-started', () => {
    const features = [
      { key: 'F-1', completionPct: 0, health: 'YELLOW', statusCategory: 'To Do', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'not-started').features).toHaveLength(1);
  });

  it('places YELLOW health features with progress in at-risk', () => {
    const features = [
      { key: 'F-1', completionPct: 30, health: 'YELLOW', statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'at-risk').features).toHaveLength(1);
  });

  it('places GREEN health features in on-track', () => {
    const features = [
      { key: 'F-1', completionPct: 60, health: 'GREEN', statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'on-track').features).toHaveLength(1);
  });

  it('handles null health by inferring from statusCategory', () => {
    const features = [
      { key: 'F-1', completionPct: 0, health: null, statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'F-2', completionPct: 0, health: null, statusCategory: 'To Do', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'on-track').features.map(f => f.key)).toEqual(['F-1']);
    expect(findGroup(groups, 'not-started').features.map(f => f.key)).toEqual(['F-2']);
  });

  it('omits empty groups', () => {
    const features = [
      { key: 'F-1', completionPct: 100, health: 'GREEN', statusCategory: 'Done', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('complete');
  });

  it('categorizes a mixed set correctly', () => {
    const features = [
      { key: 'DONE-1', completionPct: 100, health: 'GREEN', statusCategory: 'Done', blockerCount: 0 },
      { key: 'DONE-2', completionPct: 95, health: 'RED', statusCategory: 'Done', blockerCount: 0 },
      { key: 'BLOCK-1', completionPct: 40, health: 'RED', statusCategory: 'In Progress', blockerCount: 2 },
      { key: 'ATTN-1', completionPct: 30, health: 'RED', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'RISK-1', completionPct: 20, health: 'YELLOW', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'RISK-2', completionPct: 0, health: 'YELLOW', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'TODO-1', completionPct: 0, health: 'YELLOW', statusCategory: 'To Do', blockerCount: 0 },
      { key: 'TRACK-1', completionPct: 70, health: 'GREEN', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'NULL-1', completionPct: 0, health: null, statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'complete').features.map(f => f.key)).toEqual(['DONE-1', 'DONE-2']);
    expect(findGroup(groups, 'blocked').features.map(f => f.key)).toEqual(['BLOCK-1']);
    expect(findGroup(groups, 'red-other').features.map(f => f.key)).toEqual(['ATTN-1']);
    expect(findGroup(groups, 'at-risk').features.map(f => f.key)).toEqual(['RISK-1', 'RISK-2']);
    expect(findGroup(groups, 'not-started').features.map(f => f.key)).toEqual(['TODO-1']);
    expect(findGroup(groups, 'on-track').features.map(f => f.key)).toEqual(['TRACK-1', 'NULL-1']);
  });

  it('returns groups in the correct order', () => {
    const features = [
      { key: 'F-1', completionPct: 40, health: 'RED', statusCategory: 'In Progress', blockerCount: 2 },
      { key: 'F-2', completionPct: 30, health: 'RED', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'F-3', completionPct: 20, health: 'YELLOW', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'F-4', completionPct: 0, health: 'YELLOW', statusCategory: 'To Do', blockerCount: 0 },
      { key: 'F-5', completionPct: 70, health: 'GREEN', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'F-6', completionPct: 100, health: 'GREEN', statusCategory: 'Done', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(groupIds(groups)).toEqual(['blocked', 'red-other', 'at-risk', 'not-started', 'on-track', 'complete']);
  });

  it('places Closed by status name in complete when statusCategory is missing', () => {
    const features = [
      { key: 'F-1', completionPct: 0, health: 'YELLOW', status: 'Closed', statusCategory: null, blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'not-started')).toBeUndefined();
    expect(findGroup(groups, 'complete').features).toHaveLength(1);
  });

  it('places Release Pending by status name in complete when statusCategory is missing', () => {
    const features = [
      { key: 'F-1', completionPct: 0, health: 'YELLOW', status: 'Release Pending', statusCategory: null, blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'complete').features).toHaveLength(1);
  });

  it('excludes dropped features from signal buckets when live features exist', () => {
    const groups = categorizeFeatures([
      { key: 'LIVE', completionPct: 40, health: 'GREEN', statusCategory: 'In Progress' },
      { key: 'GONE', scopeChange: 'dropped', completionPct: 0, health: 'RED', blockerCount: 2 }
    ]);
    expect(findGroup(groups, 'on-track').features.map(function (f) { return f.key })).toEqual(['LIVE']);
    expect(findGroup(groups, 'blocked')).toBeUndefined();
  });
});

describe('isFeatureCompleteForSignals', () => {
  it('returns true when completionPct is 100', () => {
    expect(isFeatureCompleteForSignals({
      completionPct: 100,
      statusCategory: 'In Progress',
      status: 'In Progress'
    })).toBe(true);
  });

  it('returns true when statusCategory is Done', () => {
    expect(isFeatureCompleteForSignals({
      completionPct: 0,
      statusCategory: 'Done',
      status: 'Closed',
      health: 'YELLOW'
    })).toBe(true);
  });

  it('returns true for Release Pending by status name when category missing', () => {
    expect(isFeatureCompleteForSignals({
      completionPct: 0,
      statusCategory: null,
      status: 'Release Pending'
    })).toBe(true);
  });

  it('returns true for Closed by status name (case-insensitive) when category missing', () => {
    expect(isFeatureCompleteForSignals({
      completionPct: 0,
      statusCategory: null,
      status: 'closed'
    })).toBe(true);
  });

  it('returns false for In Progress with 0%', () => {
    expect(isFeatureCompleteForSignals({
      completionPct: 0,
      statusCategory: 'In Progress',
      status: 'In Progress',
      health: 'YELLOW'
    })).toBe(false);
  });

  it('returns false for null/undefined feature', () => {
    expect(isFeatureCompleteForSignals(null)).toBe(false);
    expect(isFeatureCompleteForSignals(undefined)).toBe(false);
  });
});

describe('summarizeSignalFeatures', () => {
  it('returns zeros for an empty list', () => {
    expect(summarizeSignalFeatures([])).toEqual({
      total: 0,
      done: 0,
      inProgress: 0,
      todo: 0,
      blockers: 0,
      totalEpics: 0,
      totalIssues: 0,
      avgCompletion: 0
    })
  })

  it('rolls up status, epics, issues, blockers, and average completion', () => {
    const stats = summarizeSignalFeatures([
      {
        key: 'A',
        statusCategory: 'Done',
        completionPct: 100,
        epicCount: 2,
        issueCount: 10,
        blockerCount: 0
      },
      {
        key: 'B',
        statusCategory: 'In Progress',
        completionPct: 40,
        epicCount: 1,
        issueCount: 5,
        blockerCount: 3
      },
      {
        key: 'C',
        statusCategory: 'To Do',
        completionPct: 0,
        epicCount: 0,
        issueCount: 1,
        blockerCount: 0
      }
    ])
    expect(stats).toEqual({
      total: 3,
      done: 1,
      inProgress: 1,
      todo: 1,
      blockers: 3,
      totalEpics: 3,
      totalIssues: 16,
      avgCompletion: 47
    })
  })

  it('treats missing statusCategory as backlog', () => {
    const stats = summarizeSignalFeatures([
      { key: 'X', completionPct: 10, epicCount: 4, issueCount: 8 }
    ])
    expect(stats.todo).toBe(1)
    expect(stats.done).toBe(0)
    expect(stats.inProgress).toBe(0)
    expect(stats.totalEpics).toBe(4)
    expect(stats.totalIssues).toBe(8)
    expect(stats.avgCompletion).toBe(10)
  })

  it('excludes dropped features from the live total', () => {
    const stats = summarizeSignalFeatures([
      { key: 'LIVE', statusCategory: 'In Progress', completionPct: 50, epicCount: 1, issueCount: 2, blockerCount: 1 },
      { key: 'GONE', scopeChange: 'dropped', statusCategory: 'To Do', completionPct: 0, epicCount: 9, issueCount: 9, blockerCount: 9 }
    ])
    expect(stats.total).toBe(1)
    expect(stats.inProgress).toBe(1)
    expect(stats.todo).toBe(0)
    expect(stats.totalEpics).toBe(1)
    expect(stats.totalIssues).toBe(2)
    expect(stats.blockers).toBe(1)
  })

  it('keeps dropped rows when the list is dropped-only', () => {
    const stats = summarizeSignalFeatures([
      { key: 'GONE', scopeChange: 'dropped', statusCategory: 'To Do' }
    ])
    expect(stats.total).toBe(1)
    expect(stats.todo).toBe(1)
  })
})
