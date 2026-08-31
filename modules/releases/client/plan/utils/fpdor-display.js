/**
 * FPDoR checklist display order — severity for attention, not for gating.
 * Ready remains: all 17 items; N/A counts as pass; only pass === false blocks.
 */

import { fpdorItemSeverity, SEVERITY_RANK } from './fpdor-severity.js'

/** Descending importance within severity tiers (execution blockers first). */
var FPDOR_IMPORTANCE_ORDER = [
  'Child epics',
  'Components',
  'Target Version',
  'Delivery Owner',
  'Release Type',
  'Requirements clarity',
  'Acceptance criteria',
  'Priority',
  'RICE',
  'Docs impact',
  'Cross-team deps',
  'PM',
  'Risks & assumptions',
  'Architectural alignment',
  'Feature human sign-off',
  'Source RFE / AI SDLC',
  'UXD'
]

function fpdorItemImportanceIndex(name) {
  var idx = FPDOR_IMPORTANCE_ORDER.indexOf(name)
  return idx === -1 ? 999 : idx
}

function fpdorItemDisplayGroup(item) {
  if (!item) return 'other'
  if (item.pass === false) return 'failed'
  if (item.state === 'not-applicable') return 'notApplicable'
  if (item.pass === true) return 'passed'
  return 'other'
}

function compareFpdorItemsByImportance(a, b) {
  return fpdorItemImportanceIndex(a.name) - fpdorItemImportanceIndex(b.name)
}

function sortFpdorItemsByImportance(items) {
  return items.slice().sort(compareFpdorItemsByImportance)
}

/**
 * Partition FPDoR items for fail-first UI: failed (by importance), N/A, passed.
 */
function partitionFpdorItemsForDisplay(items) {
  var failed = []
  var notApplicable = []
  var passed = []
  var other = []
  if (!items || !items.length) {
    return { failed: [], notApplicable: [], passed: [], other: [] }
  }
  for (var i = 0; i < items.length; i++) {
    var item = items[i]
    var group = fpdorItemDisplayGroup(item)
    if (group === 'failed') failed.push(item)
    else if (group === 'notApplicable') notApplicable.push(item)
    else if (group === 'passed') passed.push(item)
    else other.push(item)
  }
  return {
    failed: sortFpdorItemsByImportance(failed),
    notApplicable: sortFpdorItemsByImportance(notApplicable),
    passed: sortFpdorItemsByImportance(passed),
    other: sortFpdorItemsByImportance(other)
  }
}

function fpdorItemSeverityRank(name) {
  return SEVERITY_RANK[fpdorItemSeverity(name)] || 0
}

export {
  FPDOR_IMPORTANCE_ORDER,
  fpdorItemImportanceIndex,
  fpdorItemDisplayGroup,
  compareFpdorItemsByImportance,
  sortFpdorItemsByImportance,
  partitionFpdorItemsForDisplay,
  fpdorItemSeverityRank
}
