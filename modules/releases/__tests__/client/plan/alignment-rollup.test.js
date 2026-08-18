/**
 * Filtered-view TV/FV Align roll-up helpers for PM Hub.
 */
import { describe, it, expect } from 'vitest'
import {
  uniqueFeaturesFromGroups,
  countAlignment,
  buildAlignmentRollup,
  countDeliveredInVisibleVersions
} from '../../../client/plan/utils/alignment-rollup.js'

function feature(overrides) {
  return Object.assign({
    key: 'RHAISTRAT-1',
    alignmentCategory: 'aligned_on_time',
    pmDoAligned: true
  }, overrides)
}

function groupsFrom(versionFeatures) {
  return Object.keys(versionFeatures).map(function(version) {
    return {
      version: version,
      components: [{
        component: 'Dashboard',
        requestedFeatures: versionFeatures[version],
        committedFeatures: []
      }]
    }
  })
}

describe('uniqueFeaturesFromGroups', function() {
  it('counts each issue key once across components and buckets', function() {
    var groups = [{
      version: '3.6 EA2 RHOAI RELEASE',
      components: [{
        component: 'A',
        requestedFeatures: [feature({ key: 'RHAISTRAT-1' })],
        committedFeatures: [feature({ key: 'RHAISTRAT-1' })]
      }, {
        component: 'B',
        requestedFeatures: [feature({ key: 'RHAISTRAT-1' })],
        committedFeatures: []
      }]
    }]
    expect(uniqueFeaturesFromGroups(groups)).toHaveLength(1)
  })

  it('keeps the worse category when the same key appears in two versions', function() {
    var groups = groupsFrom({
      '3.6 EA2 RHOAI RELEASE': [feature({ key: 'RHAISTRAT-2', alignmentCategory: 'aligned_on_time' })],
      '3.6 EA2 RHAII RELEASE': [feature({ key: 'RHAISTRAT-2', alignmentCategory: 'tv_only' })]
    })
    var unique = uniqueFeaturesFromGroups(groups)
    expect(unique).toHaveLength(1)
    expect(unique[0].alignmentCategory).toBe('tv_only')
  })
})

describe('countAlignment', function() {
  it('computes Align % as on time plus late over unique keys', function() {
    var counts = countAlignment([
      feature({ key: 'A', alignmentCategory: 'aligned_on_time' }),
      feature({ key: 'B', alignmentCategory: 'aligned_late' }),
      feature({ key: 'C', alignmentCategory: 'tv_only' }),
      feature({ key: 'D', alignmentCategory: 'fv_only' }),
      feature({ key: 'E', alignmentCategory: 'misaligned' })
    ])
    expect(counts.total).toBe(5)
    expect(counts.aligned_on_time).toBe(1)
    expect(counts.aligned_late).toBe(1)
    expect(counts.tv_only).toBe(1)
    expect(counts.fv_only).toBe(1)
    expect(counts.misaligned).toBe(1)
    expect(counts.alignment_pct).toBe(40)
  })
})

describe('buildAlignmentRollup', function() {
  it('rolls unique keys to selected scope, then EA2, then product', function() {
    var groups = groupsFrom({
      '3.6 EA2 RHOAI RELEASE': [
        feature({ key: 'RHAISTRAT-1', alignmentCategory: 'aligned_on_time' }),
        feature({ key: 'RHAISTRAT-2', alignmentCategory: 'tv_only' })
      ],
      '3.6 EA2 RHAII RELEASE': [
        feature({ key: 'RHAISTRAT-1', alignmentCategory: 'aligned_late' }),
        feature({ key: 'RHAISTRAT-3', alignmentCategory: 'fv_only' })
      ]
    })
    var rollup = buildAlignmentRollup(groups)
    expect(rollup.scope.counts.total).toBe(3)
    expect(rollup.scope.counts.tv_only).toBe(1)
    expect(rollup.scope.counts.fv_only).toBe(1)
    expect(rollup.cycles[0].milestones[0].label).toBe('3.6 EA2 Release')
    expect(rollup.cycles[0].milestones[0].counts.total).toBe(3)
    expect(rollup.cycles[0].milestones[0].rows.map(function(r) { return r.label })).toEqual([
      'RHOAI',
      'RHAII'
    ])
    expect(rollup.cycles[0].milestones[0].rows[0].counts.total).toBe(2)
  })
})

describe('countDeliveredInVisibleVersions', function() {
  it('counts unique keys whose Fix Version is still in the filtered versions', function() {
    var issues = [
      { key: 'RHAISTRAT-10', fixVersions: ['3.6 EA2 RHOAI RELEASE'] },
      { key: 'RHAISTRAT-11', fixVersions: ['3.6 EA2 RHAII RELEASE'] },
      { key: 'RHAISTRAT-10', fixVersions: ['3.6 EA2 RHOAI RELEASE'] }
    ]
    expect(countDeliveredInVisibleVersions(issues, ['3.6 EA2 RHOAI RELEASE'])).toBe(1)
    expect(countDeliveredInVisibleVersions(issues, [
      '3.6 EA2 RHOAI RELEASE',
      '3.6 EA2 RHAII RELEASE'
    ])).toBe(2)
  })
})
