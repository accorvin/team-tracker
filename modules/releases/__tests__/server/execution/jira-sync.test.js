import { describe, it, expect, vi } from 'vitest'

const {
  fullJiraSync,
  detectStaleFeatures,
  syncAllFeatures,
  discoverFromJira,
  reconcileTrackingData
} = require('../../../server/execution/jira-sync')

function makeStorage(initialFiles = {}) {
  const files = { ...initialFiles }
  return {
    async readFromStorage(key) { return files[key] || null },
    async writeToStorage(key, data) { files[key] = data },
    async listStorageFiles(dir) {
      const prefix = dir + '/'
      return Object.keys(files)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length))
        .filter(k => !k.includes('/'))
    },
    _files: files
  }
}

// Minimal Jira issue fixture for discoverFeatures/transformForEnrichment
function makeJiraIssue(key, overrides = {}) {
  return {
    key,
    fields: {
      summary: overrides.summary || 'Feature ' + key,
      status: { name: overrides.status || 'New', statusCategory: { name: overrides.statusCategory || 'To Do' } },
      issuetype: { name: 'Feature' },
      assignee: overrides.assignee || null,
      fixVersions: (overrides.fixVersions || []).map(v => ({ name: v })),
      components: [], labels: overrides.labels || [],
      priority: { name: 'Normal' },
      issuelinks: [], created: null, updated: overrides.updated || '2026-07-01T00:00:00Z',
      parent: null,
      customfield_10001: null, customfield_10851: null, customfield_10814: null,
      customfield_10712: null, customfield_10665: null, customfield_10023: null,
      customfield_10469: null, customfield_10855: null,
      customfield_10862: null, customfield_10836: null,
      customfield_10838: null, customfield_10637: null, customfield_10864: null,
      ...overrides.fields
    },
    renderedFields: {}
  }
}

describe('fullJiraSync', () => {
  it('creates new features for unknown keys', async () => {
    const storage = makeStorage({})

    const mockFetchAll = vi.fn()
    // discoverFeatures call
    mockFetchAll.mockResolvedValueOnce([
      makeJiraIssue('RHAISTRAT-1'),
      makeJiraIssue('RHAISTRAT-2')
    ])
    // fetchEpicsForFeatures call
    mockFetchAll.mockResolvedValueOnce([])

    const result = await fullJiraSync(storage, vi.fn(), mockFetchAll)

    expect(result.status).toBe('success')
    expect(result.featureCount).toBe(2)
    expect(result.newCount).toBe(2)
    expect(result.updatedCount).toBe(0)
    expect(result.jiraKeys).toBeInstanceOf(Set)
    expect(result.jiraKeys.has('RHAISTRAT-1')).toBe(true)

    // Verify features were written
    expect(storage._files['releases/execution/features/RHAISTRAT-1.json']).toBeDefined()
    expect(storage._files['releases/execution/features/RHAISTRAT-2.json']).toBeDefined()
    expect(storage._files['releases/execution/features/RHAISTRAT-1.json']._sources.jira).toBeDefined()
  })

  it('updates existing features while preserving pipeline + AI review fields', async () => {
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1',
        summary: 'Old summary',
        status: 'New',
        metrics: { health: 'YELLOW', completionPct: 42 },
        aiReview: { recommendation: 'approve', scores: { quality: 8 } },
        _sources: { pipeline: '2026-06-01T00:00:00Z', jira: '2026-06-01T00:00:00Z' }
      }
    })

    const mockFetchAll = vi.fn()
    mockFetchAll.mockResolvedValueOnce([
      makeJiraIssue('RHAISTRAT-1', { summary: 'Updated summary', status: 'In Progress', statusCategory: 'In Progress' })
    ])
    mockFetchAll.mockResolvedValueOnce([]) // epics

    const result = await fullJiraSync(storage, vi.fn(), mockFetchAll)

    expect(result.status).toBe('success')
    expect(result.newCount).toBe(0)
    expect(result.updatedCount).toBe(1)

    const feature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(feature.summary).toBe('Updated summary')
    expect(feature.status).toBe('In Progress')
    // Pipeline fields preserved
    expect(feature.metrics).toEqual({ health: 'YELLOW', completionPct: 42 })
    // AI review preserved (existing aiReview + jira-derived humanReviewStatus merged)
    expect(feature.aiReview.recommendation).toBe('approve')
    expect(feature.aiReview.scores).toEqual({ quality: 8 })
    // Sources updated
    expect(feature._sources.pipeline).toBe('2026-06-01T00:00:00Z')
    expect(feature._sources.jira).toBeDefined()
  })

  it('handles empty Jira results gracefully (no store wipe)', async () => {
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1', summary: 'Existing',
        _sources: { jira: '2026-06-01T00:00:00Z' }
      }
    })

    const mockFetchAll = vi.fn().mockResolvedValueOnce([])

    const result = await fullJiraSync(storage, vi.fn(), mockFetchAll)

    expect(result.status).toBe('skipped')
    // Existing feature should NOT be deleted
    expect(storage._files['releases/execution/features/RHAISTRAT-1.json']).toBeDefined()
  })

  it('writes last-enrichment.json metadata', async () => {
    const storage = makeStorage({})

    const mockFetchAll = vi.fn()
    mockFetchAll.mockResolvedValueOnce([makeJiraIssue('RHAISTRAT-1')])
    mockFetchAll.mockResolvedValueOnce([])

    await fullJiraSync(storage, vi.fn(), mockFetchAll)

    const meta = storage._files['releases/execution/last-enrichment.json']
    expect(meta).toBeDefined()
    expect(meta.status).toBe('success')
    expect(meta.featureCount).toBe(1)
  })

  it('attaches epics from fetchEpicsForFeatures', async () => {
    const storage = makeStorage({})

    const mockFetchAll = vi.fn()
    mockFetchAll.mockResolvedValueOnce([makeJiraIssue('RHAISTRAT-1')])
    // Epic discovery returns a child epic
    mockFetchAll.mockResolvedValueOnce([{
      key: 'RHAISTRAT-100',
      fields: {
        summary: 'Child Epic',
        status: { name: 'In Progress' },
        parent: { key: 'RHAISTRAT-1' },
        customfield_10014: null
      }
    }])

    await fullJiraSync(storage, vi.fn(), mockFetchAll)

    const feature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(feature.epics).toHaveLength(1)
    expect(feature.epics[0].key).toBe('RHAISTRAT-100')
  })
})

describe('detectStaleFeatures', () => {
  it('flags features not returned by Jira that have _sources.jira', async () => {
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1', summary: 'Still in Jira',
        _sources: { jira: '2026-06-01T00:00:00Z' }
      },
      'releases/execution/features/RHAISTRAT-2.json': {
        key: 'RHAISTRAT-2', summary: 'Gone from Jira',
        _sources: { jira: '2026-06-01T00:00:00Z' }
      }
    })

    const jiraKeys = new Set(['RHAISTRAT-1'])
    const result = await detectStaleFeatures(storage, jiraKeys)

    expect(result.staleCount).toBe(1)
    expect(result.recoveredCount).toBe(0)

    const staleFeature = storage._files['releases/execution/features/RHAISTRAT-2.json']
    expect(staleFeature._stale).toBeDefined()
    expect(staleFeature._stale.detectedAt).toBeDefined()

    // Non-stale feature should NOT have the flag
    const activeFeature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(activeFeature._stale).toBeUndefined()
  })

  it('clears _stale on features that reappear in Jira', async () => {
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1', summary: 'Was stale, now back',
        _stale: { detectedAt: '2026-06-01T00:00:00Z' },
        _sources: { jira: '2026-06-01T00:00:00Z' }
      }
    })

    const jiraKeys = new Set(['RHAISTRAT-1'])
    const result = await detectStaleFeatures(storage, jiraKeys)

    expect(result.staleCount).toBe(0)
    expect(result.recoveredCount).toBe(1)

    const feature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(feature._stale).toBeUndefined()
  })

  it('does not flag pipeline-only features (no _sources.jira)', async () => {
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1', summary: 'Pipeline only',
        _sources: { pipeline: '2026-06-01T00:00:00Z' }
      }
    })

    const jiraKeys = new Set() // Not in Jira at all
    const result = await detectStaleFeatures(storage, jiraKeys)

    expect(result.staleCount).toBe(0)
    const feature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(feature._stale).toBeUndefined()
  })

  it('does not double-flag already stale features', async () => {
    const originalTimestamp = '2026-06-01T00:00:00Z'
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1', summary: 'Already stale',
        _stale: { detectedAt: originalTimestamp },
        _sources: { jira: '2026-05-01T00:00:00Z' }
      }
    })

    const jiraKeys = new Set()
    const result = await detectStaleFeatures(storage, jiraKeys)

    expect(result.staleCount).toBe(0) // Already stale, not newly stale
    const feature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(feature._stale.detectedAt).toBe(originalTimestamp) // Original timestamp preserved
  })

  it('handles empty store', async () => {
    const storage = makeStorage({})
    const result = await detectStaleFeatures(storage, new Set(['RHAISTRAT-1']))
    expect(result.staleCount).toBe(0)
    expect(result.recoveredCount).toBe(0)
  })
})

// Legacy function tests (kept until Phase 3 removal)
describe('syncAllFeatures (deprecated)', () => {
  it('enriches existing features and writes merged results', async () => {
    const storage = makeStorage({
      'releases/execution/features/X-1.json': {
        key: 'X-1', summary: 'Old', status: 'New',
        metrics: { health: 'YELLOW' }
      }
    })

    const mockJiraRequest = vi.fn()
    const mockFetchAll = vi.fn()
    // enrichFeatures calls fetchAllJqlResults twice (main + epics)
    mockFetchAll.mockResolvedValueOnce([{
      key: 'X-1',
      fields: {
        summary: 'Updated',
        status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
        assignee: { displayName: 'Alice', accountId: 'a-1' },
        fixVersions: [], components: [], labels: [],
        priority: { name: 'Normal' },
        issuelinks: [], created: null, updated: '2026-06-01T00:00:00Z',
        parent: null,
        customfield_10001: null, customfield_10851: null, customfield_10814: null,
        customfield_10712: null, customfield_10665: null, customfield_10023: null,
        customfield_10469: null, customfield_10862: null, customfield_10836: null,
        customfield_10838: null, customfield_10637: null, customfield_10864: null
      },
      renderedFields: {}
    }])
    mockFetchAll.mockResolvedValueOnce([]) // epics

    const result = await syncAllFeatures(storage, mockJiraRequest, mockFetchAll)

    expect(result.status).toBe('success')
    expect(result.enrichedCount).toBe(1)

    const feature = storage._files['releases/execution/features/X-1.json']
    expect(feature.status).toBe('In Progress')
    expect(feature.metrics).toEqual({ health: 'YELLOW' }) // preserved
    expect(feature._sources.jira).toBeDefined()
  })

  it('returns skipped when no features exist', async () => {
    const storage = makeStorage({})
    const result = await syncAllFeatures(storage, vi.fn(), vi.fn())
    expect(result.status).toBe('skipped')
  })
})

describe('discoverFromJira (deprecated)', () => {
  it('creates new feature entries for undiscovered keys', async () => {
    const storage = makeStorage({
      'releases/execution/features/X-1.json': { key: 'X-1' }
    })

    const mockJiraRequest = vi.fn()
    const mockFetchAll = vi.fn().mockResolvedValueOnce([
      {
        key: 'X-1',
        fields: {
          summary: 'Existing', status: { name: 'New', statusCategory: { name: 'To Do' } },
          assignee: null, fixVersions: [], components: [], labels: [],
          priority: { name: 'Normal' }, issuelinks: [], created: null, updated: null,
          parent: null,
          customfield_10001: null, customfield_10851: null, customfield_10814: null,
          customfield_10712: null, customfield_10665: null, customfield_10023: null,
          customfield_10469: null, customfield_10862: null, customfield_10836: null,
          customfield_10838: null, customfield_10637: null, customfield_10864: null
        },
        renderedFields: {}
      },
      {
        key: 'X-2',
        fields: {
          summary: 'New Feature', status: { name: 'New', statusCategory: { name: 'To Do' } },
          assignee: null, fixVersions: [], components: [], labels: [],
          priority: { name: 'Normal' }, issuelinks: [], created: null, updated: null,
          parent: null,
          customfield_10001: null, customfield_10851: null, customfield_10814: null,
          customfield_10712: null, customfield_10665: null, customfield_10023: null,
          customfield_10469: null, customfield_10862: null, customfield_10836: null,
          customfield_10838: null, customfield_10637: null, customfield_10864: null
        },
        renderedFields: {}
      }
    ])

    const result = await discoverFromJira(storage, mockJiraRequest, mockFetchAll, {})
    expect(result.newFeatures).toBe(1)
    expect(storage._files['releases/execution/features/X-2.json']).toBeDefined()
  })
})

describe('reconcileTrackingData (deprecated)', () => {
  it('creates stubs for tracking keys not in store', async () => {
    const storage = makeStorage({
      'releases/execution/features/X-1.json': { key: 'X-1' },
      'releases/execution/tracking-data-3.5.json': {
        features: { 'X-1': { key: 'X-1' }, 'X-2': { key: 'X-2' } }
      }
    })

    const result = await reconcileTrackingData(storage)
    expect(result.newStubs).toBe(1)
    expect(storage._files['releases/execution/features/X-2.json']).toBeDefined()
    expect(storage._files['releases/execution/features/X-2.json'].key).toBe('X-2')
  })

  it('handles array-style features', async () => {
    const storage = makeStorage({
      'releases/execution/tracking-data-3.5.json': {
        features: [{ key: 'X-1' }, { key: 'X-2' }]
      }
    })

    const result = await reconcileTrackingData(storage)
    expect(result.newStubs).toBe(2)
  })

  it('returns zero stubs when all keys exist', async () => {
    const storage = makeStorage({
      'releases/execution/features/X-1.json': { key: 'X-1' },
      'releases/execution/tracking-data-3.5.json': {
        features: { 'X-1': { key: 'X-1' } }
      }
    })

    const result = await reconcileTrackingData(storage)
    expect(result.newStubs).toBe(0)
  })
})
