import { describe, it, expect } from 'vitest'
import {
  partitionFpdorItemsForDisplay,
  sortFpdorItemsByImportance,
  fpdorItemDisplayGroup,
  FPDOR_IMPORTANCE_ORDER
} from '../../../client/plan/utils/fpdor-display.js'

describe('fpdor-display', function() {
  it('orders failed items by descending importance (critical before soft)', function() {
    var items = [
      { name: 'UXD', pass: false },
      { name: 'Child epics', pass: false },
      { name: 'Docs impact', pass: false }
    ]
    var failed = partitionFpdorItemsForDisplay(items).failed
    expect(failed.map(function(i) { return i.name })).toEqual([
      'Child epics',
      'Docs impact',
      'UXD'
    ])
  })

  it('partitions failed, not-applicable, and passed', function() {
    var items = [
      { name: 'PM', pass: false },
      { name: 'UXD', pass: true, state: 'not-applicable' },
      { name: 'Target Version', pass: true, state: 'passed' },
      { name: 'Child epics', pass: false }
    ]
    var groups = partitionFpdorItemsForDisplay(items)
    expect(groups.failed.map(function(i) { return i.name })).toEqual(['Child epics', 'PM'])
    expect(groups.notApplicable.map(function(i) { return i.name })).toEqual(['UXD'])
    expect(groups.passed.map(function(i) { return i.name })).toEqual(['Target Version'])
  })

  it('covers all 17 checklist names in importance order', function() {
    expect(FPDOR_IMPORTANCE_ORDER).toHaveLength(17)
  })

  it('classifies display groups', function() {
    expect(fpdorItemDisplayGroup({ pass: false })).toBe('failed')
    expect(fpdorItemDisplayGroup({ pass: true, state: 'not-applicable' })).toBe('notApplicable')
    expect(fpdorItemDisplayGroup({ pass: true, state: 'passed' })).toBe('passed')
  })

  it('sortFpdorItemsByImportance is stable within list', function() {
    var sorted = sortFpdorItemsByImportance([
      { name: 'RICE' },
      { name: 'Child epics' },
      { name: 'Priority' }
    ])
    expect(sorted.map(function(i) { return i.name })).toEqual([
      'Child epics',
      'Priority',
      'RICE'
    ])
  })
})
