import { describe, it, expect, vi } from 'vitest';

const {
  scanLabels,
  fetchAiAdoptionData,
  AI_PIPELINE_TAXONOMY,
  PIPELINE_KEYS,
  RELEASE_GROUPS,
  PROJECTS
} = require('../../../server/ai-adoption/pipeline');

// ---------------------------------------------------------------------------
// scanLabels
// ---------------------------------------------------------------------------

describe('scanLabels', () => {
  it('returns touched=false for empty labels', () => {
    const result = scanLabels([]);
    expect(result.touched).toBe(false);
    for (const k of PIPELINE_KEYS) {
      expect(result.pipelines[k]).toBe(0);
    }
  });

  it('returns touched=false for unrelated labels', () => {
    const result = scanLabels(['bugfix', 'priority-high', 'team-green']);
    expect(result.touched).toBe(false);
  });

  it('detects a single stratCreator label', () => {
    const result = scanLabels(['strat-creator-auto-created']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.stratCreator).toBe(1);
    expect(result.pipelines.rfeCreator).toBe(0);
  });

  it('detects rfeCreator labels', () => {
    const result = scanLabels(['rfe-creator-auto-created', 'rfe-creator-feasibility-pass']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.rfeCreator).toBe(1);
  });

  it('detects testPlan labels', () => {
    const result = scanLabels(['test-plan-auto-created', 'test-plan-rubric-pass']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.testPlan).toBe(1);
  });

  it('detects qg1 labels', () => {
    const result = scanLabels(['rp-qg1-auto-rice']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.qg1).toBe(1);
  });

  it('detects aiDoc labels', () => {
    const result = scanLabels(['ai1st-doc-contributed']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.aiDoc).toBe(1);
  });

  it('detects uxdAgentic label', () => {
    const result = scanLabels(['uxd-agentic']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.uxdAgentic).toBe(1);
  });

  it('detects multiple pipelines simultaneously', () => {
    const result = scanLabels([
      'strat-creator-auto-created',
      'rfe-creator-auto-created',
      'test-plan-rubric-pass',
      'rp-qg1-pass',
      'ai1st-doc-invoked',
      'uxd-agentic'
    ]);
    expect(result.touched).toBe(true);
    for (const k of PIPELINE_KEYS) {
      expect(result.pipelines[k]).toBe(1);
    }
  });

  it('handles mixed AI and non-AI labels', () => {
    const result = scanLabels(['team-green', 'strat-creator-rubric-pass', 'bugfix']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.stratCreator).toBe(1);
    expect(result.pipelines.rfeCreator).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('exports expected pipeline keys', () => {
    expect(PIPELINE_KEYS).toEqual(
      expect.arrayContaining(['stratCreator', 'rfeCreator', 'testPlan', 'qg1', 'aiDoc', 'uxdAgentic'])
    );
    expect(PIPELINE_KEYS).toHaveLength(6);
  });

  it('exports expected release groups', () => {
    const names = RELEASE_GROUPS.map(g => g.name);
    expect(names).toEqual(['3.4 GA', '3.5 EA1', '3.5 EA2', '3.5 GA']);
  });

  it('exports expected projects', () => {
    expect(PROJECTS).toEqual(
      expect.arrayContaining(['AIPCC', 'RHAIENG', 'RHOAIENG', 'INFERENG', 'RHAI', 'RHAISTRAT'])
    );
  });

  it('each pipeline has at least one prefix', () => {
    for (const key of PIPELINE_KEYS) {
      expect(AI_PIPELINE_TAXONOMY[key].prefixes.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// fetchAiAdoptionData
// ---------------------------------------------------------------------------

describe('fetchAiAdoptionData', () => {
  function makeMockJira(issuesByJql) {
    return {
      fetchAllJqlResults: vi.fn(async (jql) => issuesByJql[jql] || [])
    };
  }

  function makeIssue(key, labels, components) {
    return {
      key,
      fields: {
        summary: key,
        status: { name: 'New' },
        labels: labels || [],
        components: (components || []).map(name => ({ name })),
        fixVersions: []
      }
    };
  }

  it('returns empty results for no issues', async () => {
    const jira = makeMockJira({});
    const results = await fetchAiAdoptionData(jira);
    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r.totalFeatures).toBe(0);
      expect(r.aiTouchedFeatures).toBe(0);
      expect(r.components).toEqual([]);
    }
  });

  it('filters by releaseGroup option', async () => {
    const jira = makeMockJira({});
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 GA' });
    expect(results).toHaveLength(1);
    expect(results[0].releaseGroup).toBe('3.5 GA');
  });

  it('counts AI-touched features and component pipelines', async () => {
    const issues = [
      makeIssue('TEST-1', ['strat-creator-auto-created', 'rfe-creator-auto-created'], ['Dashboard']),
      makeIssue('TEST-2', ['test-plan-auto-created'], ['Dashboard']),
      makeIssue('TEST-3', [], ['Dashboard']),
      makeIssue('TEST-4', ['uxd-agentic'], ['Other Comp'])
    ];

    const jira = {
      fetchAllJqlResults: vi.fn(async () => issues)
    };

    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 GA' });
    expect(results).toHaveLength(1);

    const r = results[0];
    expect(r.totalFeatures).toBe(4);
    expect(r.aiTouchedFeatures).toBe(3);
    expect(r.components).toHaveLength(2);

    const dashboard = r.components.find(c => c.name === 'Dashboard');
    expect(dashboard.total).toBe(3);
    expect(dashboard.aiTouched).toBe(2);
    expect(dashboard.pipelines.stratCreator).toBe(1);
    expect(dashboard.pipelines.rfeCreator).toBe(1);
    expect(dashboard.pipelines.testPlan).toBe(1);

    const other = r.components.find(c => c.name === 'Other Comp');
    expect(other.total).toBe(1);
    expect(other.aiTouched).toBe(1);
    expect(other.pipelines.uxdAgentic).toBe(1);
  });

  it('deduplicates components across issues', async () => {
    const issues = [
      makeIssue('A-1', ['strat-creator-auto-created'], ['Shared']),
      makeIssue('B-1', ['rfe-creator-auto-created'], ['Shared'])
    ];

    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.4 GA' });
    const shared = results[0].components.find(c => c.name === 'Shared');
    expect(shared.total).toBe(2);
    expect(shared.aiTouched).toBe(2);
    expect(shared.pipelines.stratCreator).toBe(1);
    expect(shared.pipelines.rfeCreator).toBe(1);
  });

  it('handles issues with no components', async () => {
    const issues = [makeIssue('X-1', ['uxd-agentic'], [])];
    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.4 GA' });
    const noComp = results[0].components.find(c => c.name === '(No Component)');
    expect(noComp).toBeDefined();
    expect(noComp.total).toBe(1);
    expect(noComp.aiTouched).toBe(1);
  });

  it('filters by component option', async () => {
    const issues = [
      makeIssue('A-1', ['strat-creator-auto-created'], ['Alpha']),
      makeIssue('B-1', ['rfe-creator-auto-created'], ['Beta'])
    ];

    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.4 GA', component: 'Alpha' });
    expect(results[0].components).toHaveLength(1);
    expect(results[0].components[0].name).toBe('Alpha');
    expect(results[0].totalFeatures).toBe(1);
  });

  it('does not double-count multi-component issues when filtering', async () => {
    const issues = [
      makeIssue('A-1', ['strat-creator-auto-created'], ['Dashboard', 'UXD']),
      makeIssue('B-1', ['rfe-creator-auto-created'], ['Dashboard', 'UXD']),
      makeIssue('C-1', [], ['Dashboard']),
      makeIssue('D-1', ['uxd-agentic'], ['UXD'])
    ];

    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 GA', component: 'Dashboard' });
    expect(results[0].totalFeatures).toBe(3);
    expect(results[0].aiTouchedFeatures).toBe(2);
    expect(results[0].components).toHaveLength(1);
    expect(results[0].components[0].name).toBe('Dashboard');
    expect(results[0].components[0].total).toBe(3);
  });

  it('sorts components by aiTouched descending', async () => {
    const issues = [
      makeIssue('A-1', [], ['Low']),
      makeIssue('B-1', ['strat-creator-auto-created'], ['High']),
      makeIssue('C-1', ['strat-creator-auto-created'], ['High']),
      makeIssue('D-1', ['rfe-creator-auto-created'], ['Mid'])
    ];

    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 GA' });
    const names = results[0].components.map(c => c.name);
    expect(names[0]).toBe('High');
    expect(names[1]).toBe('Mid');
    expect(names[2]).toBe('Low');
  });

  it('handles Jira fetch failure gracefully', async () => {
    const jira = {
      fetchAllJqlResults: vi.fn(async () => { throw new Error('network error'); })
    };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 EA1' });
    expect(results).toHaveLength(1);
    expect(results[0].totalFeatures).toBe(0);
    expect(results[0].components).toEqual([]);
  });
});
