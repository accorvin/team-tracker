import { describe, it, expect, vi } from 'vitest';
import { processIssue, extractLabelDate } from '../../server/jira/rfe-fetcher.js';

const DEFAULT_CONFIG = {
  jiraProject: 'RHAIRFE',
  linkedProject: 'RHAISTRAT',
  createdLabel: 'rfe-creator-auto-created',
  revisedLabel: 'rfe-creator-auto-revised',
  testExclusionLabel: 'rfe-creator-skill-testing',
  linkTypeName: 'Cloners',
  excludedStatuses: ['Closed'],
  lookbackMonths: 12,
  trendThresholdPp: 2
};

function makeIssue(overrides = {}) {
  return {
    key: 'RHAIRFE-1',
    fields: {
      summary: 'Test RFE',
      status: { name: 'New' },
      priority: { name: 'High' },
      created: '2026-03-15T10:00:00Z',
      creator: { name: 'testuser', displayName: 'Test User', emailAddress: 'test@example.com' },
      labels: [],
      issuelinks: [],
      ...overrides
    }
  };
}

describe('extractLabelDate', () => {
  it('returns null when changelog is missing', () => {
    expect(extractLabelDate(null, 'some-label')).toBeNull();
    expect(extractLabelDate(undefined, 'some-label')).toBeNull();
    expect(extractLabelDate({}, 'some-label')).toBeNull();
  });

  it('returns the date when label was added once', () => {
    const changelog = {
      histories: [{
        created: '2026-03-20T14:30:00.000+0000',
        items: [{
          field: 'labels',
          fromString: '',
          toString: 'rfe-creator-auto-created'
        }]
      }]
    };
    expect(extractLabelDate(changelog, 'rfe-creator-auto-created')).toBe('2026-03-20T14:30:00.000+0000');
  });

  it('returns the latest addition date when label was removed and re-added', () => {
    const changelog = {
      histories: [
        {
          created: '2026-03-10T10:00:00.000+0000',
          items: [{ field: 'labels', fromString: '', toString: 'rfe-creator-auto-created' }]
        },
        {
          created: '2026-03-15T10:00:00.000+0000',
          items: [{ field: 'labels', fromString: 'rfe-creator-auto-created', toString: '' }]
        },
        {
          created: '2026-03-25T10:00:00.000+0000',
          items: [{ field: 'labels', fromString: '', toString: 'rfe-creator-auto-created' }]
        }
      ]
    };
    expect(extractLabelDate(changelog, 'rfe-creator-auto-created')).toBe('2026-03-25T10:00:00.000+0000');
  });

  it('returns null when label was never added via changelog (present since creation)', () => {
    const changelog = {
      histories: [{
        created: '2026-03-20T14:30:00.000+0000',
        items: [{ field: 'status', fromString: 'New', toString: 'In Progress' }]
      }]
    };
    expect(extractLabelDate(changelog, 'rfe-creator-auto-created')).toBeNull();
  });

  it('correctly identifies the target label among multiple labels in one history entry', () => {
    const changelog = {
      histories: [{
        created: '2026-03-20T14:30:00.000+0000',
        items: [{
          field: 'labels',
          fromString: 'other-label',
          toString: 'other-label rfe-creator-auto-created'
        }]
      }]
    };
    expect(extractLabelDate(changelog, 'rfe-creator-auto-created')).toBe('2026-03-20T14:30:00.000+0000');
    expect(extractLabelDate(changelog, 'other-label')).toBeNull();
  });

  it('returns latest date even when histories are in reverse-chronological order', () => {
    const changelog = {
      histories: [
        {
          created: '2026-03-25T10:00:00.000+0000',
          items: [{ field: 'labels', fromString: '', toString: 'rfe-creator-auto-created' }]
        },
        {
          created: '2026-03-10T10:00:00.000+0000',
          items: [{ field: 'labels', fromString: '', toString: 'rfe-creator-auto-created' }]
        }
      ]
    };
    expect(extractLabelDate(changelog, 'rfe-creator-auto-created')).toBe('2026-03-25T10:00:00.000+0000');
  });
});

describe('processIssue', () => {
  it('processes an issue correctly', () => {
    const issue = makeIssue({ labels: ['rfe-creator-auto-created'] });
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.key).toBe('RHAIRFE-1');
    expect(result.summary).toBe('Test RFE');
    expect(result.status).toBe('New');
    expect(result.priority).toBe('High');
    expect(result.aiInvolvement).toBe('created');
    expect(result._rawIssueLinks).toEqual([]);
    expect(result.linkedFeature).toBeNull();
  });

  it('preserves _rawIssueLinks for link-resolver', () => {
    const links = [{ type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-1' } }];
    const issue = makeIssue({ issuelinks: links });
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result._rawIssueLinks).toEqual(links);
  });

  it('classifies AI involvement as both', () => {
    const issue = makeIssue({ labels: ['rfe-creator-auto-created', 'rfe-creator-auto-revised'] });
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.aiInvolvement).toBe('both');
  });

  it('classifies AI involvement as revised', () => {
    const issue = makeIssue({ labels: ['rfe-creator-auto-revised'] });
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.aiInvolvement).toBe('revised');
  });

  it('classifies AI involvement as none', () => {
    const issue = makeIssue({ labels: ['unrelated-label'] });
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.aiInvolvement).toBe('none');
  });

  it('handles missing status gracefully', () => {
    const issue = makeIssue();
    issue.fields.status = null;
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.status).toBe('Unknown');
  });

  it('handles missing priority gracefully', () => {
    const issue = makeIssue();
    issue.fields.priority = null;
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.priority).toBe('None');
  });

  it('extracts creator display name', () => {
    const issue = makeIssue();
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.creatorDisplayName).toBe('Test User');
  });

  it('extracts all labels', () => {
    const issue = makeIssue({ labels: ['rfe-creator-auto-created', 'customer-request'] });
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.labels).toEqual(['rfe-creator-auto-created', 'customer-request']);
  });

  it('populates createdLabelDate from changelog when label is present', () => {
    const issue = makeIssue({ labels: ['rfe-creator-auto-created'] });
    issue.changelog = {
      histories: [{
        created: '2026-03-20T14:30:00.000+0000',
        items: [{ field: 'labels', fromString: '', toString: 'rfe-creator-auto-created' }]
      }]
    };
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.createdLabelDate).toBe('2026-03-20T14:30:00.000+0000');
    expect(result.revisedLabelDate).toBeNull();
  });

  it('populates revisedLabelDate from changelog when label is present', () => {
    const issue = makeIssue({ labels: ['rfe-creator-auto-revised'] });
    issue.changelog = {
      histories: [{
        created: '2026-03-22T09:00:00.000+0000',
        items: [{ field: 'labels', fromString: '', toString: 'rfe-creator-auto-revised' }]
      }]
    };
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.revisedLabelDate).toBe('2026-03-22T09:00:00.000+0000');
    expect(result.createdLabelDate).toBeNull();
  });

  it('falls back to created date when label is present but no changelog entry', () => {
    const issue = makeIssue({ labels: ['rfe-creator-auto-created'] });
    // No changelog
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.createdLabelDate).toBe('2026-03-15T10:00:00Z');
  });

  it('sets label dates to null when label was removed (not currently present)', () => {
    const issue = makeIssue({ labels: [] });
    issue.changelog = {
      histories: [{
        created: '2026-03-20T14:30:00.000+0000',
        items: [{ field: 'labels', fromString: '', toString: 'rfe-creator-auto-created' }]
      }]
    };
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.createdLabelDate).toBeNull();
    expect(result.revisedLabelDate).toBeNull();
  });

  it('sets both label dates to null when no AI labels', () => {
    const issue = makeIssue({ labels: ['unrelated'] });
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.createdLabelDate).toBeNull();
    expect(result.revisedLabelDate).toBeNull();
  });
});

describe('fetchRFEData JQL validation', () => {
  it('rejects unsafe config values', async () => {
    const { fetchRFEData } = await import('../../server/jira/rfe-fetcher.js');
    const mockJiraRequest = vi.fn();
    const unsafeConfig = { ...DEFAULT_CONFIG, jiraProject: 'BAD"PROJECT' };
    await expect(fetchRFEData(mockJiraRequest, unsafeConfig)).rejects.toThrow('unsafe characters');
  });

  it('rejects unsafe excluded statuses', async () => {
    const { fetchRFEData } = await import('../../server/jira/rfe-fetcher.js');
    const mockJiraRequest = vi.fn();
    const unsafeConfig = { ...DEFAULT_CONFIG, excludedStatuses: ['Bad;Status'] };
    await expect(fetchRFEData(mockJiraRequest, unsafeConfig)).rejects.toThrow('unsafe characters');
  });
});
