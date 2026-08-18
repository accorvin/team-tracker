/**
 * Filtered-view TV/FV Align roll-up for PM Hub.
 * Unique issue keys; categories are the same five as Reports → TV vs FV Delta.
 * Scope follows the groups already on screen (pillar / component / product / blocked / docs).
 */

import { worseAlignmentCategory } from './tv-fv-alignment-display.js'
import {
  extractCycle,
  extractMilestoneGroup,
  extractProduct,
  cycleLabel,
  milestoneGroupLabel,
  productLabel
} from '../../composables/useReleaseFamily.js'

export var ALIGNMENT_COUNT_KEYS = [
  'aligned_on_time',
  'aligned_late',
  'tv_only',
  'fv_only',
  'misaligned'
]

export function emptyAlignmentCounts() {
  return {
    total: 0,
    aligned_on_time: 0,
    aligned_late: 0,
    tv_only: 0,
    fv_only: 0,
    misaligned: 0,
    alignment_pct: 0
  }
}

export function finishCounts(counts) {
  var aligned = (counts.aligned_on_time || 0) + (counts.aligned_late || 0)
  counts.alignment_pct = counts.total > 0 ? Math.round((aligned / counts.total) * 100) : 0
  return counts
}

export function countAlignment(features) {
  var counts = emptyAlignmentCounts()
  var list = features || []
  for (var i = 0; i < list.length; i++) {
    counts.total++
    var cat = list[i] && list[i].alignmentCategory
    if (cat && counts[cat] != null) counts[cat]++
  }
  return finishCounts(counts)
}

/**
 * Unique features across requested + committed lists.
 * Worst alignmentCategory wins when the same key appears in more than one version.
 */
export function uniqueFeaturesFromGroups(groups) {
  var byKey = {}
  var groupsArr = groups || []
  for (var gi = 0; gi < groupsArr.length; gi++) {
    var version = groupsArr[gi].version
    var comps = groupsArr[gi].components || []
    for (var ci = 0; ci < comps.length; ci++) {
      var lists = [comps[ci].requestedFeatures || [], comps[ci].committedFeatures || []]
      for (var li = 0; li < lists.length; li++) {
        for (var fi = 0; fi < lists[li].length; fi++) {
          var f = lists[li][fi]
          if (!f || !f.key) continue
          if (!byKey[f.key]) {
            byKey[f.key] = {
              key: f.key,
              alignmentCategory: f.alignmentCategory || null,
              byVersion: {}
            }
          }
          var nextCat = worseAlignmentCategory(
            byKey[f.key].byVersion[version] || null,
            f.alignmentCategory || null
          )
          byKey[f.key].byVersion[version] = nextCat
          byKey[f.key].alignmentCategory = worseAlignmentCategory(
            byKey[f.key].alignmentCategory,
            f.alignmentCategory || null
          )
        }
      }
    }
  }
  var keys = Object.keys(byKey)
  var out = []
  for (var i = 0; i < keys.length; i++) out.push(byKey[keys[i]])
  return out
}

export function visibleVersionNames(groups) {
  var names = []
  var src = groups || []
  for (var i = 0; i < src.length; i++) {
    if (src[i] && src[i].version) names.push(src[i].version)
  }
  return names
}

/**
 * Count closed issues whose Fix Version intersects the versions still visible
 * after client-side filters (for example Product).
 */
export function countDeliveredInVisibleVersions(deliveredIssues, versionNames) {
  var allowed = {}
  var names = versionNames || []
  for (var i = 0; i < names.length; i++) allowed[names[i]] = true
  var seen = {}
  var count = 0
  var issues = deliveredIssues || []
  for (var di = 0; di < issues.length; di++) {
    var issue = issues[di]
    if (!issue || !issue.key || seen[issue.key]) continue
    var fvs = issue.fixVersions || []
    var match = false
    for (var vi = 0; vi < fvs.length; vi++) {
      if (allowed[fvs[vi]]) {
        match = true
        break
      }
    }
    if (!match) continue
    seen[issue.key] = true
    count++
  }
  return count
}

function sortCycleKeys(keys) {
  return keys.slice().sort(function(a, b) {
    if (a === 'other') return 1
    if (b === 'other') return -1
    return String(b).localeCompare(String(a), undefined, { numeric: true })
  })
}

function milestoneRank(key) {
  if (/-EA1$/.test(key)) return 1
  if (/-EA2$/.test(key)) return 2
  if (/-GA$/.test(key)) return 3
  return 9
}

/**
 * Hierarchical roll-up of the filtered groups: selected scope → milestone → product.
 */
export function buildAlignmentRollup(groups) {
  var src = groups || []
  var scope = {
    key: 'selected-scope',
    kind: 'scope',
    label: 'Selected scope',
    versionNames: visibleVersionNames(src),
    counts: countAlignment(uniqueFeaturesFromGroups(src))
  }

  var cycleMap = {}
  var cycleOrder = []
  for (var gi = 0; gi < src.length; gi++) {
    var version = src[gi].version
    var cycle = extractCycle(version) || 'other'
    var milestone = extractMilestoneGroup(version) || (cycle + '-other')
    var product = extractProduct(version)
    if (!cycleMap[cycle]) {
      cycleMap[cycle] = {
        key: cycle,
        label: cycle === 'other' ? 'Other' : cycleLabel(cycle),
        milestones: {},
        milestoneOrder: []
      }
      cycleOrder.push(cycle)
    }
    var c = cycleMap[cycle]
    if (!c.milestones[milestone]) {
      c.milestones[milestone] = {
        key: milestone,
        label: milestone.endsWith('-other') ? 'Other' : milestoneGroupLabel(milestone),
        versionNames: [],
        groups: []
      }
      c.milestoneOrder.push(milestone)
    }
    var ms = c.milestones[milestone]
    ms.versionNames.push(version)
    ms.groups.push(src[gi])
    ms.rows = ms.rows || []
    ms.rows.push({
      key: version,
      kind: 'product',
      label: product ? productLabel(product) : version,
      product: product ? productLabel(product) : null,
      versionNames: [version],
      counts: countAlignment(uniqueFeaturesFromGroups([src[gi]]))
    })
  }

  cycleOrder = sortCycleKeys(cycleOrder)
  var cycles = []
  for (var ci = 0; ci < cycleOrder.length; ci++) {
    var cyc = cycleMap[cycleOrder[ci]]
    cyc.milestoneOrder.sort(function(a, b) {
      return milestoneRank(a) - milestoneRank(b)
    })
    var milestones = []
    for (var mi = 0; mi < cyc.milestoneOrder.length; mi++) {
      var mk = cyc.milestoneOrder[mi]
      var msRow = cyc.milestones[mk]
      milestones.push({
        key: msRow.key,
        kind: 'milestone',
        label: msRow.label,
        versionNames: msRow.versionNames,
        counts: countAlignment(uniqueFeaturesFromGroups(msRow.groups)),
        rows: msRow.rows || []
      })
    }
    cycles.push({
      key: cyc.key,
      label: cyc.label,
      milestones: milestones
    })
  }

  return { scope: scope, cycles: cycles }
}
