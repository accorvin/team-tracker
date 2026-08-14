/**
 * Unit tests for Features List column sorting helpers.
 */
import { describe, it, expect } from 'vitest'
import {
  getSortValue,
  compareByDefaultScore,
  sortFeatures,
  nextSortState,
  SORTABLE_COLUMNS
} from '../../../client/plan/utils/feature-readiness-sort.js'

function feature(overrides) {
  return Object.assign({
    key: 'RHAISTRAT-1',
    title: 'Alpha',
    bigRock: 'Outcome A',
    targetVersions: ['3.6'],
    fixVersion: 'rhoai-3.6',
    components: ['Dashboard'],
    team: 'Platform',
    status: 'In Progress',
    priority: 'Major',
    recommendation: 'revise',
    effectivePriorityScore: 50,
    rubricTotal: 10,
    rank: 5,
    needsAttention: false,
    fpdor: { items: [] },
    confidence: 'ready'
  }, overrides)
}

describe('feature-readiness-sort', function() {
  it('lists expected sortable columns', function() {
    expect(SORTABLE_COLUMNS).toContain('score')
    expect(SORTABLE_COLUMNS).toContain('key')
    expect(SORTABLE_COLUMNS).toContain('readiness')
  })

  it('getSortValue returns numeric score and priority order', function() {
    expect(getSortValue(feature({ effectivePriorityScore: 72 }), 'score')).toBe(72)
    expect(getSortValue(feature({ priority: 'Blocker' }), 'priority')).toBe(0)
    expect(getSortValue(feature({ priority: 'Normal' }), 'priority')).toBe(3)
  })

  it('getSortValue ranks readiness by fail severity (ready = 0)', function() {
    expect(getSortValue(feature({ fpdor: { items: [{ name: 'UXD', pass: true }] } }), 'readiness')).toBe(0)
    expect(getSortValue(feature({
      fpdor: { items: [{ name: 'Components', pass: false }] }
    }), 'readiness')).toBe(4)
  })

  it('compareByDefaultScore prefers higher score then higher rubric', function() {
    var a = feature({ effectivePriorityScore: 40, rubricTotal: 20, key: 'A' })
    var b = feature({ effectivePriorityScore: 80, rubricTotal: 5, key: 'B' })
    expect(compareByDefaultScore(a, b)).toBeGreaterThan(0)
    var c = feature({ effectivePriorityScore: 50, rubricTotal: 1, key: 'C' })
    var d = feature({ effectivePriorityScore: 50, rubricTotal: 9, key: 'D' })
    expect(compareByDefaultScore(c, d)).toBeGreaterThan(0)
  })

  it('sortFeatures uses default score order when column is null', function() {
    var sorted = sortFeatures([
      feature({ key: 'Low', effectivePriorityScore: 10 }),
      feature({ key: 'High', effectivePriorityScore: 90 }),
      feature({ key: 'Mid', effectivePriorityScore: 40 })
    ], { column: null, direction: 'asc' })
    expect(sorted.map(function(f) { return f.key })).toEqual(['High', 'Mid', 'Low'])
  })

  it('sortFeatures sorts by key ascending', function() {
    var sorted = sortFeatures([
      feature({ key: 'C-3' }),
      feature({ key: 'A-1' }),
      feature({ key: 'B-2' })
    ], { column: 'key', direction: 'asc' })
    expect(sorted.map(function(f) { return f.key })).toEqual(['A-1', 'B-2', 'C-3'])
  })

  it('sortFeatures sorts by score descending', function() {
    var sorted = sortFeatures([
      feature({ key: 'Low', effectivePriorityScore: 10 }),
      feature({ key: 'High', effectivePriorityScore: 90 })
    ], { column: 'score', direction: 'desc' })
    expect(sorted[0].key).toBe('High')
  })

  it('nextSortState uses desc-first for score then asc then clear', function() {
    var s1 = nextSortState({ column: null, direction: 'asc' }, 'score')
    expect(s1).toEqual({ column: 'score', direction: 'desc' })
    var s2 = nextSortState(s1, 'score')
    expect(s2).toEqual({ column: 'score', direction: 'asc' })
    var s3 = nextSortState(s2, 'score')
    expect(s3).toEqual({ column: null, direction: 'asc' })
  })

  it('nextSortState uses asc-first for title', function() {
    var s1 = nextSortState({ column: null, direction: 'asc' }, 'title')
    expect(s1).toEqual({ column: 'title', direction: 'asc' })
    var s2 = nextSortState(s1, 'title')
    expect(s2).toEqual({ column: 'title', direction: 'desc' })
    var s3 = nextSortState(s2, 'title')
    expect(s3).toEqual({ column: null, direction: 'asc' })
  })
})
