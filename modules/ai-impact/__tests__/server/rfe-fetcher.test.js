import { describe, it, expect, vi } from 'vitest';
import { processIssue } from '../../server/jira/rfe-fetcher.js';

const DEFAULT_CONFIG = {
  jiraProject: 'RHAIRFE',
  linkedProject: 'RHAISTRAT',
  createdLabelPrefix: 'rfe-creator-',
  assessedLabelPrefix: 'rfe-assess-',
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

describe('processIssue', () => {
  it('processes an issue correctly', () => {
    const issue = makeIssue({ labels: ['rfe-creator-v2'] });
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
    const issue = makeIssue({ labels: ['rfe-creator-v2', 'rfe-assess-v1'] });
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.aiInvolvement).toBe('both');
  });

  it('classifies AI involvement as assessed', () => {
    const issue = makeIssue({ labels: ['rfe-assess-v1'] });
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.aiInvolvement).toBe('assessed');
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
    const issue = makeIssue({ labels: ['rfe-creator-v2', 'customer-request'] });
    const result = processIssue(issue, DEFAULT_CONFIG);
    expect(result.labels).toEqual(['rfe-creator-v2', 'customer-request']);
  });
});

describe('fetchRFEData JQL validation', () => {
  // Test that unsafe config values are rejected at JQL construction time
  // by importing fetchRFEData and passing a mock jiraRequest
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
