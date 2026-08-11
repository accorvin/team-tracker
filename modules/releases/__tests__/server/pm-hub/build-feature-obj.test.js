import { describe, it, expect } from 'vitest'

const {
  buildFeatureObj,
  extractTargetVersions,
  computePmDoAligned,
  versionsStrictMatch
} = require('../../../server/pm-hub/routes')

describe('buildFeatureObj', function () {
  var fullInput = {
    key: 'RHAIENG-123',
    summary: 'Add model serving support',
    status: 'In Progress',
    statusCategory: 'In Progress',
    colorStatus: 'Green',
    statusSummary: '<p>On track</p>',
    releaseType: 'Feature',
    priority: 'Major',
    isBlocked: false,
    components: ['Inference', 'Serving'],
    fixVersions: ['rhoai-3.5', 'rhoai-3.6'],
    assignee: 'Alice',
    pmOwner: 'Bob',
    labels: ['strat-creator-auto-created'],
    riceScore: 12,
    docsRequired: 'Yes',
    linkedRfeKey: 'RHAIRFE-1'
  }

  it('maps core fields and attaches FPDoR + alignment', function () {
    var result = buildFeatureObj(fullInput, ['rhoai-3.5'])
    expect(result.key).toBe('RHAIENG-123')
    expect(result.summary).toBe('Add model serving support')
    expect(result.title).toBe('Add model serving support')
    expect(result.targetVersions).toEqual(['rhoai-3.5'])
    expect(result.fixVersions).toEqual(['rhoai-3.5', 'rhoai-3.6'])
    expect(result.pmDoAligned).toBe(true)
    expect(result.fpdor).toBeTruthy()
    expect(Array.isArray(result.fpdor.items)).toBe(true)
    expect(result.fpdor.totalCount).toBe(17)
    expect(result.isAiFirst).toBe(true)
    expect(result.confidence).toBeTruthy()
    expect(result.labels).toEqual(['strat-creator-auto-created'])
  })

  it('defaults missing fields to null or empty', function () {
    var result = buildFeatureObj({ key: 'X-1' })
    expect(result.key).toBe('X-1')
    expect(result.summary).toBe('')
    expect(result.pmDoAligned).toBe(false)
    expect(result.isAiFirst).toBe(false)
    expect(result.fpdor).toBeTruthy()
    expect(result.confidence).toBe('not-ready')
  })

  it('marks pmDoAligned false when TV/FV mismatch', function () {
    var result = buildFeatureObj(fullInput, ['rhoai-3.7'])
    expect(result.pmDoAligned).toBe(false)
  })

  it('does not include unrelated hygiene fields', function () {
    var input = Object.assign({}, fullInput, {
      team: 'Some Team',
      violations: ['missing-summary']
    })
    var result = buildFeatureObj(input, [])
    expect(result).not.toHaveProperty('team')
    expect(result).not.toHaveProperty('violations')
    expect(result.linkedRfeKey).toBe('RHAIRFE-1')
  })
})

describe('computePmDoAligned / versionsStrictMatch', function () {
  it('returns true for exact string match', function () {
    expect(versionsStrictMatch('rhoai-3.5', 'rhoai-3.5')).toBe(true)
    expect(computePmDoAligned(['rhoai-3.5'], ['rhoai-3.5'])).toBe(true)
  })

  it('returns false when either side is missing', function () {
    expect(computePmDoAligned([], ['rhoai-3.5'])).toBe(false)
    expect(computePmDoAligned(['rhoai-3.5'], [])).toBe(false)
  })

  it('returns false for early delivery (FV before TV in same cycle)', function () {
    // EA1 FV vs GA TV should not be strict match
    expect(computePmDoAligned(['3.5 EA1 RHOAI RELEASE'], ['3.5 GA RHOAI RELEASE'])).toBe(false)
  })

  it('returns true when any FV matches any TV', function () {
    expect(computePmDoAligned(['rhoai-3.4', 'rhoai-3.5'], ['rhoai-3.5', 'rhoai-3.6'])).toBe(true)
  })
})

describe('extractTargetVersions', function () {
  var TV_FIELD = 'customfield_10855'

  it('extracts target version names from array field', function () {
    var raw = { fields: { [TV_FIELD]: [{ name: 'rhoai-3.5' }, { name: 'rhelai-3.5' }] } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.5', 'rhelai-3.5'])
  })

  it('extracts from single object (non-array) field', function () {
    var raw = { fields: { [TV_FIELD]: { name: 'rhoai-3.6' } } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.6'])
  })

  it('uses value property when name is missing', function () {
    var raw = { fields: { [TV_FIELD]: [{ value: 'rhoai-3.5' }] } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.5'])
  })

  it('prefers name over value', function () {
    var raw = { fields: { [TV_FIELD]: [{ name: 'rhoai-3.5', value: 'rhoai-3.5-alt' }] } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.5'])
  })

  it('returns empty array when field is missing', function () {
    var raw = { fields: {} }
    expect(extractTargetVersions(raw)).toEqual([])
  })

  it('returns empty array when fields is missing', function () {
    var raw = {}
    expect(extractTargetVersions(raw)).toEqual([])
  })

  it('returns empty array when field is null', function () {
    var raw = { fields: { [TV_FIELD]: null } }
    expect(extractTargetVersions(raw)).toEqual([])
  })

  it('returns empty array when field is empty array', function () {
    var raw = { fields: { [TV_FIELD]: [] } }
    expect(extractTargetVersions(raw)).toEqual([])
  })

  it('skips entries with null name and value', function () {
    var raw = { fields: { [TV_FIELD]: [{ name: 'rhoai-3.5' }, null, { name: null }] } }
    expect(extractTargetVersions(raw)).toEqual(['rhoai-3.5'])
  })
})
