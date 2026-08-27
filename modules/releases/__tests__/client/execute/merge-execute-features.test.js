import { describe, it, expect } from 'vitest'
import { mergeExecuteFeatures } from '../../../client/execute/helpers/merge-execute-features.js'

function trackingFeature(overrides) {
  return Object.assign({
    key: 'RHAISTRAT-1',
    summary: 'Tracking title',
    issueType: 'Feature',
    colorStatus: 'Green',
    statusSummary: 'On track',
    isBlocked: false,
    components: ['Serving'],
    assignee: 'Ada',
    pmOwner: 'Pam',
    status: 'In Progress',
    team: 'Serving',
    scopeChange: null
  }, overrides)
}

function hygieneFeature(overrides) {
  return Object.assign({
    key: 'RHAISTRAT-1',
    summary: 'Hygiene title',
    issueType: 'Feature',
    status: 'In Progress',
    statusCategory: 'In Progress',
    assignee: 'Ada',
    team: 'Serving',
    components: ['Serving'],
    colorStatus: 'Green',
    violations: [{ id: 'missing-team', name: 'Missing Team' }],
    _family: 'rhoai'
  }, overrides)
}

function execFeature(overrides) {
  return Object.assign({
    key: 'RHAISTRAT-1',
    summary: 'Exec title',
    status: 'In Progress',
    statusCategory: 'In Progress',
    completionPct: 40,
    epicCount: 2,
    issueCount: 8,
    blockerCount: 0,
    health: 'YELLOW',
    lastUpdated: '2026-08-01T00:00:00.000Z'
  }, overrides)
}

describe('mergeExecuteFeatures', function () {
  it('joins the three sources by Jira key and keeps unique overlays', function () {
    var result = mergeExecuteFeatures({
      trackingGroups: [{
        product: 'rhoai',
        label: 'RHOAI: rhoai-3.6',
        releaseNumber: 'rhoai-3.6',
        features: [trackingFeature({ scopeChange: 'added', pmOwner: 'Pam' })]
      }],
      hygieneFeatures: {
        'RHAISTRAT-1': hygieneFeature()
      },
      executionFeatures: [execFeature()]
    })

    expect(result.features).toHaveLength(1)
    var f = result.features[0]
    expect(f.key).toBe('RHAISTRAT-1')
    expect(f.scopeChange).toBe('added')
    expect(f.pmOwner).toBe('Pam')
    expect(f.violations).toHaveLength(1)
    expect(f.completionPct).toBe(40)
    expect(f.health).toBe('YELLOW')
    expect(f.epicCount).toBe(2)
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].product).toBe('rhoai')
    expect(result.groups[0].features[0].key).toBe('RHAISTRAT-1')
  })

  it('keeps hygiene-only and execution-only records', function () {
    var result = mergeExecuteFeatures({
      trackingGroups: [],
      hygieneFeatures: {
        'HYG-1': hygieneFeature({ key: 'HYG-1', summary: 'Hygiene only', _family: 'rhoai' })
      },
      executionFeatures: [execFeature({ key: 'EXE-1', summary: 'Exec only' })]
    })

    var keys = result.features.map(function (f) { return f.key }).sort()
    expect(keys).toEqual(['EXE-1', 'HYG-1'])
    var hyg = result.features.find(function (f) { return f.key === 'HYG-1' })
    expect(hyg.violations).toHaveLength(1)
    expect(hyg.completionPct).toBe(null)
    var exe = result.features.find(function (f) { return f.key === 'EXE-1' })
    expect(exe.completionPct).toBe(40)
    expect(exe.violations).toEqual([])
  })

  it('filters tracking groups to selected families', function () {
    var result = mergeExecuteFeatures({
      selectedFamilies: ['rhoai'],
      trackingGroups: [
        {
          product: 'rhoai',
          label: 'RHOAI',
          features: [trackingFeature({ key: 'RHOAI-1' })]
        },
        {
          product: 'rhelai',
          label: 'RHELAI',
          features: [trackingFeature({ key: 'RHEL-1', summary: 'RHEL feature' })]
        }
      ],
      hygieneFeatures: {},
      executionFeatures: []
    })

    expect(result.features.map(function (f) { return f.key })).toEqual(['RHOAI-1'])
    expect(result.groups.map(function (g) { return g.product })).toEqual(['rhoai'])
  })

  it('marks blocked when any source reports a blocker', function () {
    var fromTracking = mergeExecuteFeatures({
      trackingGroups: [{
        product: 'rhoai',
        features: [trackingFeature({ isBlocked: true })]
      }],
      hygieneFeatures: {},
      executionFeatures: []
    })
    expect(fromTracking.features[0].isBlocked).toBe(true)

    var fromExec = mergeExecuteFeatures({
      trackingGroups: [],
      hygieneFeatures: {},
      executionFeatures: [execFeature({ blockerCount: 2 })]
    })
    expect(fromExec.features[0].isBlocked).toBe(true)
  })

  it('appends leftover hygiene features onto the matching product group', function () {
    var result = mergeExecuteFeatures({
      trackingGroups: [{
        product: 'rhoai',
        label: 'RHOAI',
        features: [trackingFeature({ key: 'T-1' })]
      }],
      hygieneFeatures: {
        'H-1': hygieneFeature({ key: 'H-1', summary: 'Extra', _family: 'rhoai', violations: [] })
      },
      executionFeatures: []
    })

    expect(result.groups).toHaveLength(1)
    var keys = result.groups[0].features.map(function (f) { return f.key }).sort()
    expect(keys).toEqual(['H-1', 'T-1'])
  })
})
