import { escapeCsv, escapeCell, triggerDownload } from './health-export.js'
import { alignmentCategoryLabel } from './tv-fv-alignment-display.js'
import { failedFpdorNames } from './feature-readiness-export.js'

// ─── Column definitions for the Component Load (issues) table ───

var LOAD_COLUMNS = [
  { label: 'Pillar', getter: function(row) { return row._pillar || '' } },
  { label: 'Component', getter: function(row) { return row.component } },
  { label: 'Feature Key', getter: function(row) { return row.key } },
  { label: 'Title', getter: function(row) { return row.summary } },
  { label: 'Priority', getter: function(row) { return row.priority || '' } },
  { label: 'Release Type', getter: function(row) { return row.releaseType || '' } },
  { label: 'Status', getter: function(row) { return row.status || '' } },
  { label: 'Color Status', getter: function(row) { return row.colorStatus || '' } },
  { label: 'Fix Version', getter: function(row) { return (row.fixVersions || []).join('; ') } },
  { label: 'Target Version', getter: function(row) { return (row.targetVersions || []).join('; ') } },
  { label: 'Blocked', getter: function(row) { return row.isBlocked ? 'Yes' : 'No' } },
  { label: 'TV/FV Alignment', getter: function(row) { return alignmentCategoryLabel(row.alignmentCategory) } },
  { label: 'FPDoR', getter: function(row) {
    if (!row.fpdor) return ''
    return row.fpdor.passedCount + '/' + (row.fpdor.totalCount || 17)
  }},
  { label: 'Failed FPDoR Items', getter: function(row) { return failedFpdorNames(row).join('; ') } },
  { label: 'Delivery Owner', getter: function(row) { return row.assignee || '' } },
  { label: 'PM Owner', getter: function(row) { return row.pmOwner || '' } },
  { label: 'Docs Required', getter: function(row) { return row.docsRequired || '' } },
  { label: 'Requested', getter: function(row) { return row.isRequested ? 'Yes' : 'No' } },
  { label: 'Committed', getter: function(row) { return row.isCommitted ? 'Yes' : 'No' } }
]

// ─── Column definitions for the TV/FV Alignment rollup ───

var ALIGN_HEADERS = [
  'Release', 'Total',
  'Early or as requested', 'After requested (yellow)', 'After requested (green)',
  'TV only', 'FV only', 'Misaligned', 'Align %'
]

function alignCountsToRow(label, counts) {
  var c = counts || {}
  return [
    label,
    c.total || 0,
    c.aligned_on_time || 0,
    c.after_requested || 0,
    c.aligned_late || 0,
    c.tv_only || 0,
    c.fv_only || 0,
    c.misaligned || 0,
    c.alignment_pct != null ? c.alignment_pct + '%' : ''
  ]
}

function buildAlignmentRows(rollup) {
  var rows = []
  if (!rollup || !rollup.scope) return rows
  rows.push(alignCountsToRow(rollup.scope.label, rollup.scope.counts))
  var cycles = rollup.cycles || []
  for (var ci = 0; ci < cycles.length; ci++) {
    var milestones = cycles[ci].milestones || []
    for (var mi = 0; mi < milestones.length; mi++) {
      var ms = milestones[mi]
      rows.push(alignCountsToRow('  ' + ms.label, ms.counts))
      var productRows = ms.rows || []
      for (var ri = 0; ri < productRows.length; ri++) {
        rows.push(alignCountsToRow('    ' + productRows[ri].label, productRows[ri].counts))
      }
    }
  }
  return rows
}

// ─── Flatten component groups into a flat row-per-feature array ───

/**
 * @param {Array} groups - filtered component groups
 * @param {Object} [componentToPillar] - map of component name → pillar name(s) string
 */
function flattenGroups(groups, componentToPillar) {
  var pillarMap = componentToPillar || {}
  var compMap = {}

  for (var gi = 0; gi < groups.length; gi++) {
    var group = groups[gi]
    for (var ci = 0; ci < group.components.length; ci++) {
      var comp = group.components[ci]
      var cName = comp.component
      if (!compMap[cName]) compMap[cName] = {}

      var reqList = comp.requestedFeatures || []
      var comList = comp.committedFeatures || []
      var reqKeys = {}
      var comKeys = {}
      for (var ri = 0; ri < reqList.length; ri++) reqKeys[reqList[ri].key] = true
      for (var cmi = 0; cmi < comList.length; cmi++) comKeys[comList[cmi].key] = true

      var lists = [reqList, comList]
      for (var li = 0; li < lists.length; li++) {
        for (var fi = 0; fi < lists[li].length; fi++) {
          var f = lists[li][fi]
          if (!compMap[cName][f.key]) {
            compMap[cName][f.key] = Object.assign({}, f, {
              component: cName,
              _pillar: pillarMap[cName] || '',
              isRequested: false,
              isCommitted: false
            })
          }
          if (reqKeys[f.key]) compMap[cName][f.key].isRequested = true
          if (comKeys[f.key]) compMap[cName][f.key].isCommitted = true
        }
      }
    }
  }

  var rows = []
  var names = Object.keys(compMap).sort()
  for (var ni = 0; ni < names.length; ni++) {
    var features = Object.values(compMap[names[ni]])
    features.sort(function(a, b) { return (a.key || '').localeCompare(b.key || '') })
    for (var fi2 = 0; fi2 < features.length; fi2++) rows.push(features[fi2])
  }
  return rows
}

// ─── Helpers ───

function buildFilename(ext) {
  var today = new Date().toISOString().split('T')[0]
  return 'component-release-load-' + today + '.' + ext
}

// ─── CSV export ───

export function exportComponentLoadCsv(groups, rollup, summary, componentToPillar) {
  var lines = []

  if (summary) {
    lines.push(escapeCsv('Summary'))
    lines.push(escapeCsv('Requested') + ',' + escapeCsv(String(summary.requested)))
    lines.push(escapeCsv('Committed') + ',' + escapeCsv(String(summary.committed)))
    lines.push(escapeCsv('Delivered') + ',' + escapeCsv(String(summary.delivered)))
    lines.push(escapeCsv('Blocked') + ',' + escapeCsv(String(summary.blocked)))
    lines.push('')
  }

  if (rollup && rollup.scope) {
    lines.push(escapeCsv('TV/FV Alignment'))
    lines.push(ALIGN_HEADERS.map(escapeCsv).join(','))
    var alignRows = buildAlignmentRows(rollup)
    for (var ai = 0; ai < alignRows.length; ai++) {
      lines.push(alignRows[ai].map(function(v) { return escapeCsv(String(v)) }).join(','))
    }
    lines.push('')
  }

  lines.push(escapeCsv('Component Load'))
  var featureRows = flattenGroups(groups, componentToPillar)
  lines.push(LOAD_COLUMNS.map(function(c) { return escapeCsv(c.label) }).join(','))
  for (var fi = 0; fi < featureRows.length; fi++) {
    lines.push(LOAD_COLUMNS.map(function(c) { return escapeCsv(c.getter(featureRows[fi])) }).join(','))
  }

  var csv = lines.join('\n') + '\n'
  triggerDownload(new Blob([csv], { type: 'text/csv' }), buildFilename('csv'))
}

// ─── Markdown export ───

export function exportComponentLoadMarkdown(groups, rollup, summary, componentToPillar) {
  var lines = []
  var generated = new Date().toISOString()

  lines.push('# Component Release Load Report')
  lines.push('')
  lines.push('**Generated:** ' + generated)
  lines.push('')

  if (summary) {
    lines.push('## Summary')
    lines.push('')
    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push('| Requested | ' + summary.requested + ' |')
    lines.push('| Committed | ' + summary.committed + ' |')
    lines.push('| Delivered | ' + summary.delivered + ' |')
    lines.push('| Blocked | ' + summary.blocked + ' |')
    lines.push('')
  }

  if (rollup && rollup.scope) {
    lines.push('## TV/FV Alignment')
    lines.push('')
    lines.push('| ' + ALIGN_HEADERS.join(' | ') + ' |')
    lines.push('|' + ALIGN_HEADERS.map(function() { return '------' }).join('|') + '|')
    var alignRows = buildAlignmentRows(rollup)
    for (var ai = 0; ai < alignRows.length; ai++) {
      lines.push('| ' + alignRows[ai].map(function(v) { return escapeCell(String(v)) }).join(' | ') + ' |')
    }
    lines.push('')
  }

  lines.push('## Component Load')
  lines.push('')
  lines.push('| ' + LOAD_COLUMNS.map(function(c) { return c.label }).join(' | ') + ' |')
  lines.push('|' + LOAD_COLUMNS.map(function() { return '------' }).join('|') + '|')
  var featureRows = flattenGroups(groups, componentToPillar)
  for (var fi = 0; fi < featureRows.length; fi++) {
    lines.push('| ' + LOAD_COLUMNS.map(function(c) { return escapeCell(c.getter(featureRows[fi])) }).join(' | ') + ' |')
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('*Report generated by RHOAI Org Pulse*')
  lines.push('')

  var blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
  triggerDownload(blob, buildFilename('md'))
}
