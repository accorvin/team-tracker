#!/usr/bin/env node
/**
 * Feature Risk Report — local FPDoR readiness by release event.
 * Usage: node scripts/feature-risk-report/generate-feature-risk-report.js
 *        node scripts/feature-risk-report/generate-feature-risk-report.js --html-only
 */

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.join(__dirname, '../..')
const DATA_DIR = path.join(__dirname, 'data')

const { computeFPDoRReadiness } = require(path.join(REPO_ROOT, 'modules/releases/server/planning/fpdor'))
const { normalizeIssue } = require(path.join(REPO_ROOT, 'modules/releases/server/planning/feature-query'))
const { parseDescriptionSignals } = require(path.join(REPO_ROOT, 'modules/releases/server/planning/health/description-scanner'))

const EVAL_DATE = '2026-08-27'
const CYCLE = '3.6'
const PRODUCTS = ['RHOAI', 'RHAII', 'RHELAI']
const TV_SUFFIX = ' RELEASE'

const EVENTS = [
  {
    key: 'execute',
    phase: 'EA2',
    cohort: 'passed',
    cohortLabel: 'Passed freeze',
    assignmentField: 'fixVersion',
    assignmentLabel: 'Fix Version'
  },
  {
    key: 'plan',
    phase: 'GA',
    cohort: 'upcoming',
    cohortLabel: 'Upcoming freeze',
    assignmentField: 'targetVersion',
    assignmentLabel: 'Target Version'
  }
]

function eventTabLabel(event) {
  return CYCLE + ' ' + event.phase + ' (' + event.assignmentLabel + ' · ' + event.cohortLabel.toLowerCase() + ')'
}

function _eventSectionTitle(event) {
  return CYCLE + ' ' + event.phase
}

const _SEVERITY_RANK = { soft: 1, medium: 2, high: 3, critical: 4 }
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'soft']

const FPDOR_SEVERITY_BY_NAME = {
  Components: 'critical',
  'Child epics': 'critical',
  'Target Version': 'critical',
  'Delivery Owner': 'critical',
  'Release Type': 'high',
  Priority: 'high',
  RICE: 'high',
  'Docs impact': 'high',
  'Cross-team deps': 'medium',
  PM: 'medium',
  'Feature human sign-off': 'medium',
  'Requirements clarity': 'medium',
  'Acceptance criteria': 'medium',
  'Risks & assumptions': 'medium',
  'Architectural alignment': 'medium',
  UXD: 'soft',
  'Source RFE / AI SDLC': 'soft'
}

function fpdorItemSeverity(name) {
  return FPDOR_SEVERITY_BY_NAME[name] || 'medium'
}

function versionName(phase, product) {
  return CYCLE + ' ' + phase + ' ' + product + TV_SUFFIX
}

function phaseFromReleaseNumber(releaseNumber) {
  const num = String(releaseNumber || '').toLowerCase()
  if (!num.includes('3.6')) return null
  if (num.includes('ea2')) return 'EA2'
  if (num.includes('ea1')) return null
  if (/[-.]3\.6$/.test(num)) return 'GA'
  return null
}

function loadProductPagesFreezes() {
  const cachePath = path.join(REPO_ROOT, 'fixtures/releases/delivery/product-pages-releases-cache.json')
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
  const map = {}
  for (const entry of cache.releases || []) {
    const product = String(entry.productName || '').toUpperCase()
    if (PRODUCTS.indexOf(product) === -1) continue
    const phase = phaseFromReleaseNumber(entry.releaseNumber)
    if (!phase) continue
    if (!map[product]) map[product] = {}
    map[product][phase] = {
      releaseNumber: entry.releaseNumber,
      planningFreezeDate: entry.planningFreezeDate,
      dueDate: entry.dueDate
    }
  }
  return map
}

function defaultFreeze(product, phase) {
  if (phase === 'EA2') {
    return { releaseNumber: product.toLowerCase() + '-3.6.EA2', planningFreezeDate: '2026-08-26', dueDate: '2026-10-15' }
  }
  return { releaseNumber: product.toLowerCase() + '-3.6', planningFreezeDate: '2026-09-23', dueDate: '2026-11-19' }
}

function _cohortForFreeze(freezeDate) {
  if (!freezeDate) return 'unknown'
  return freezeDate > EVAL_DATE ? 'upcoming' : 'passed'
}

function extractLinkedRfe(issue) {
  const fields = issue.fields || {}
  const links = fields.issuelinks || []
  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    const candidates = [link.outwardIssue, link.inwardIssue]
    for (let j = 0; j < candidates.length; j++) {
      const linked = candidates[j]
      if (!linked || !linked.key) continue
      if (/^RHAIRFE-/i.test(linked.key)) return linked.key
    }
  }
  const desc = typeof fields.description === 'string' ? fields.description : ''
  const m = desc.match(/RHAIRFE-\d+/i)
  return m ? m[0].toUpperCase() : null
}

function versionNamesFromField(list) {
  if (!Array.isArray(list)) return []
  const names = []
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    names.push(item && item.name ? item.name : String(item || ''))
  }
  return names
}

function fixVersionAlignment(fixVersionNames, phase, product) {
  const expected = versionName(phase, product)
  const committed = fixVersionNames.indexOf(expected) !== -1
  const misalignedFixVersions = []
  for (let pi = 0; pi < PRODUCTS.length; pi++) {
    const p = PRODUCTS[pi]
    const vn = versionName(phase, p)
    if (fixVersionNames.indexOf(vn) !== -1 && vn !== expected) {
      misalignedFixVersions.push(vn)
    }
  }
  for (let pi = 0; pi < PRODUCTS.length; pi++) {
    const p = PRODUCTS[pi]
    const ea2Vn = versionName('EA2', p)
    if (phase !== 'EA2' && fixVersionNames.indexOf(ea2Vn) !== -1) {
      misalignedFixVersions.push(ea2Vn)
    }
  }
  return {
    fixVersionCommitted: committed,
    misalignedFixVersions: Array.from(new Set(misalignedFixVersions))
  }
}

function countEpicsFromIssueLinks(issue) {
  const fields = issue.fields || {}
  const links = fields.issuelinks || []
  let count = 0
  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    const candidates = [link.outwardIssue, link.inwardIssue]
    for (let j = 0; j < candidates.length; j++) {
      const linked = candidates[j]
      if (!linked || !linked.fields || !linked.fields.issuetype) continue
      const typeName = linked.fields.issuetype.name || ''
      if (typeName === 'Epic') count++
    }
  }
  return count
}

function loadEpicCounts() {
  const epicPath = path.join(DATA_DIR, 'jira-3.6-ea2-epic-counts.json')
  if (!fs.existsSync(epicPath)) return {}
  return JSON.parse(fs.readFileSync(epicPath, 'utf8')).counts || {}
}

function toFeatureRecord(issue, epicCounts) {
  const normalized = normalizeIssue(issue)
  const fields = issue.fields || {}
  if (fields.description && !normalized.descriptionSignals) {
    normalized.descriptionSignals = parseDescriptionSignals(fields.description)
  }
  normalized.linkedRfeKey = extractLinkedRfe(issue)
  const linkedEpicCount = countEpicsFromIssueLinks(issue)
  const parentEpicCount = epicCounts[issue.key] || 0
  normalized.epicCount = Math.max(linkedEpicCount, parentEpicCount)
  return normalized
}

function failedItemsBySeverity(fpdor) {
  const grouped = { critical: [], high: [], medium: [], soft: [] }
  const items = fpdor.items || []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.pass !== false) continue
    const sev = fpdorItemSeverity(item.name)
    grouped[sev].push(item)
  }
  return grouped
}

function computeFeatureRisk(fpdor) {
  const fails = failedItemsBySeverity(fpdor)
  const criticalCount = fails.critical.length
  const highCount = fails.high.length
  const mediumCount = fails.medium.length
  const softCount = fails.soft.length

  if (criticalCount > 0 || highCount >= 2) {
    return { level: 'high', criticalCount, highCount, mediumCount, softCount }
  }
  if (highCount === 1 || mediumCount > 0) {
    return { level: 'medium', criticalCount, highCount, mediumCount, softCount }
  }
  if (softCount > 0) {
    return { level: 'low', criticalCount, highCount, mediumCount, softCount }
  }
  return { level: 'low', criticalCount, highCount, mediumCount, softCount, ready: true }
}

function productRollupRisk(features) {
  let high = 0
  let medium = 0
  let low = 0
  let ready = 0
  for (let i = 0; i < features.length; i++) {
    const f = features[i]
    if (f.featureRisk.ready) ready++
    if (f.featureRisk.level === 'high') high++
    else if (f.featureRisk.level === 'medium') medium++
    else low++
  }
  let level = 'low'
  if (high > 0) level = 'high'
  else if (medium > 0) level = 'medium'
  return { level, high, medium, low, ready, total: features.length }
}

function buildFailureIndex(features) {
  const index = {}
  for (let si = 0; si < SEVERITY_ORDER.length; si++) {
    index[SEVERITY_ORDER[si]] = {}
  }
  for (let i = 0; i < features.length; i++) {
    const feature = features[i]
    const fails = failedItemsBySeverity(feature.fpdor)
    for (let si = 0; si < SEVERITY_ORDER.length; si++) {
      const sev = SEVERITY_ORDER[si]
      const items = fails[sev]
      for (let j = 0; j < items.length; j++) {
        const itemName = items[j].name
        if (!index[sev][itemName]) index[sev][itemName] = []
        index[sev][itemName].push({
          key: feature.key,
          summary: feature.title,
          detail: items[j].detail || null,
          featureRisk: feature.featureRisk.level,
          fixVersionCommitted: feature.fixVersionCommitted,
          misalignedFixVersions: feature.misalignedFixVersions || []
        })
      }
    }
  }
  return index
}

function buildProductBlock(product, event, features, freeze) {
  const rollup = productRollupRisk(features)
  let committed = 0
  let misaligned = 0
  if (event.phase === 'GA') {
    for (let i = 0; i < features.length; i++) {
      if (features[i].fixVersionCommitted) committed++
      else misaligned++
    }
  }

  return {
    product: product,
    phase: event.phase,
    planningFreezeDate: freeze.planningFreezeDate,
    cohort: event.cohort,
    cohortLabel: event.cohort === 'passed' ? 'Passed' : (event.cohort === 'upcoming' ? 'Upcoming' : 'Unknown'),
    assignmentField: event.assignmentField,
    assignmentLabel: event.assignmentLabel,
    total: features.length,
    ready: rollup.ready,
    fixVersionCommitted: event.phase === 'GA' ? committed : null,
    fixVersionMisaligned: event.phase === 'GA' ? misaligned : null,
    risk: rollup,
    failureIndex: buildFailureIndex(features),
    features: features.map(function(f) {
      return {
        key: f.key,
        title: f.title,
        status: f.status,
        ready: f.ready,
        featureRisk: f.featureRisk.level,
        fixVersionCommitted: f.fixVersionCommitted,
        misalignedFixVersions: f.misalignedFixVersions || [],
        passedCount: f.fpdor.passedCount,
        totalCount: f.fpdor.totalCount,
        failedItems: (f.fpdor.items || []).filter(function(it) { return it.pass === false }).map(function(it) {
          return { name: it.name, severity: fpdorItemSeverity(it.name), detail: it.detail }
        })
      }
    })
  }
}

function buildEventBlock(event, placements, freezes) {
  const byProduct = {}
  let totalReady = 0
  let totalHigh = 0
  let totalMedium = 0
  let totalLow = 0
  let totalCommitted = 0
  let totalMisaligned = 0

  for (let i = 0; i < PRODUCTS.length; i++) {
    const product = PRODUCTS[i]
    const freeze = (freezes[product] && freezes[product][event.phase]) || defaultFreeze(product, event.phase)
    const features = placements.filter(function(f) {
      return f.eventKey === event.key && f.product === product
    })
    const block = buildProductBlock(product, event, features, freeze)
    byProduct[product] = block
    totalReady += block.ready
    totalHigh += block.risk.high
    totalMedium += block.risk.medium
    totalLow += block.risk.low
    if (event.phase === 'GA') {
      totalCommitted += block.fixVersionCommitted || 0
      totalMisaligned += block.fixVersionMisaligned || 0
    }
  }

  const eventFeatures = placements.filter(function(f) { return f.eventKey === event.key })
  const uniqueIssueKeys = new Set(eventFeatures.map(function(f) { return f.key }))

  return {
    key: event.key,
    phase: event.phase,
    tabLabel: eventTabLabel(event),
    cohort: event.cohort,
    cohortLabel: event.cohortLabel,
    assignmentField: event.assignmentField,
    assignmentLabel: event.assignmentLabel,
    totals: {
      features: eventFeatures.length,
      uniqueIssues: uniqueIssueKeys.size,
      ready: totalReady,
      risk: { high: totalHigh, medium: totalMedium, low: totalLow },
      fixVersionCommitted: event.phase === 'GA' ? totalCommitted : null,
      fixVersionMisaligned: event.phase === 'GA' ? totalMisaligned : null
    },
    byProduct: byProduct
  }
}

function _commitmentLabel(feature) {
  if (feature.fixVersionCommitted) return 'Committed (FV matches TV)'
  if (feature.misalignedFixVersions && feature.misalignedFixVersions.length) {
    return 'Misaligned FV: ' + feature.misalignedFixVersions.join(', ')
  }
  return 'Not committed (no matching Fix Version)'
}

function renderMarkdown(report) {
  const lines = []
  lines.push('# Feature Risk Report — ' + CYCLE + ' EA2 + GA')
  lines.push('')
  lines.push('- **Generated:** ' + report.generatedAt)
  lines.push('- **Evaluation date:** ' + EVAL_DATE)
  lines.push('- **Data source:** Live Jira (RHAISTRAT + AIPCC, open Features/Initiatives)')
  lines.push('- **Cohort rules:** EA2 (passed freeze) by Fix Version; GA (upcoming freeze) by Target Version')
  lines.push('- **Feature placements:** ' + report.totals.features + ' (unique issues: ' + report.totals.uniqueIssues + ')')
  lines.push('- **Planning freeze source:** Product Pages cache (`fixtures/releases/delivery/product-pages-releases-cache.json`)')
  lines.push('')
  lines.push('## Feature risk rules')
  lines.push('')
  lines.push('| Level | Rule |')
  lines.push('|-------|------|')
  lines.push('| **High** | Any critical FPDoR fail, or 2+ high-severity fails |')
  lines.push('| **Medium** | Exactly one high fail, or any medium fail (no critical) |')
  lines.push('| **Low** | All pass, or only soft-severity fails |')
  lines.push('')
  lines.push('**Portfolio:** ' + report.totals.features + ' feature placements across EA2 + GA; ' +
    report.totals.ready + ' FPDoR-ready; ' +
    report.totals.risk.high + ' high / ' + report.totals.risk.medium + ' medium / ' + report.totals.risk.low + ' low feature risk.')

  const gaEvent = report.events.plan
  if (gaEvent && gaEvent.totals.features > 0) {
    lines.push('')
    lines.push('**GA Fix Version commitment:** ' + gaEvent.totals.fixVersionCommitted + ' committed, ' +
      gaEvent.totals.fixVersionMisaligned + ' TV/FV misaligned (Target Version without matching Fix Version).')
  }

  for (let ei = 0; ei < EVENTS.length; ei++) {
    const eventDef = EVENTS[ei]
    const eventBlock = report.events[eventDef.key]
    lines.push('')
    lines.push('## ' + eventTabLabel(eventDef))
    lines.push('')
    lines.push('- **Cohort:** ' + eventDef.cohortLabel + ' (' + (eventDef.cohort === 'passed' ? 'Execute' : 'Plan') + ')')
    lines.push('- **Membership rule:** ' + eventDef.assignmentLabel)
    lines.push('- **Features:** ' + eventBlock.totals.features + ' (' + eventBlock.totals.ready + ' ready)')
    if (eventDef.phase === 'GA') {
      lines.push('- **Fix Version committed:** ' + eventBlock.totals.fixVersionCommitted + ' / ' + eventBlock.totals.features)
      lines.push('- **TV/FV misaligned:** ' + eventBlock.totals.fixVersionMisaligned)
    }
    lines.push('')
    lines.push('### Executive summary')
    lines.push('')
    lines.push('| Product | Cohort | Assignment | Planning freeze | Features | FPDoR ready | High | Medium | Low | Product risk |')
    lines.push('|---------|--------|------------|-----------------|----------|-------------|------|--------|-----|--------------|')

    for (let pi = 0; pi < PRODUCTS.length; pi++) {
      const product = PRODUCTS[pi]
      const block = eventBlock.byProduct[product]
      lines.push('| ' + [
        product,
        block.cohortLabel,
        block.assignmentLabel,
        block.planningFreezeDate || '—',
        block.total,
        block.ready,
        block.risk.high,
        block.risk.medium,
        block.risk.low,
        '**' + block.risk.level.toUpperCase() + '**'
      ].join(' | ') + ' |')
    }

    lines.push('')
    lines.push('### Details by product and FPDoR item')
    lines.push('')

    for (let pi = 0; pi < PRODUCTS.length; pi++) {
      const product = PRODUCTS[pi]
      const block = eventBlock.byProduct[product]
      lines.push('#### ' + product + ' — ' + CYCLE + ' ' + eventDef.phase)
      lines.push('')
      lines.push('- Planning freeze: **' + (block.planningFreezeDate || 'unknown') + '**')
      lines.push('- Assignment field: **' + block.assignmentLabel + '**')
      lines.push('- Features: **' + block.total + '** (' + block.ready + ' ready, ' + (block.total - block.ready) + ' not ready)')
      lines.push('- Feature risk: **' + block.risk.level.toUpperCase() + '**')
      if (eventDef.phase === 'GA' && block.total > 0) {
        lines.push('- Fix Version committed: **' + block.fixVersionCommitted + '**; misaligned: **' + block.fixVersionMisaligned + '**')
      }
      lines.push('')

      const failureIndex = block.failureIndex
      let anyFailures = false
      for (let si = 0; si < SEVERITY_ORDER.length; si++) {
        const sev = SEVERITY_ORDER[si]
        const items = failureIndex[sev]
        const itemNames = Object.keys(items).sort()
        if (itemNames.length === 0) continue
        anyFailures = true
        lines.push('##### ' + sev.charAt(0).toUpperCase() + sev.slice(1))
        lines.push('')
        for (let ii = 0; ii < itemNames.length; ii++) {
          const itemName = itemNames[ii]
          const feats = items[itemName]
          lines.push('###### ' + itemName + ' (' + feats.length + ')')
          lines.push('')
          feats.sort(function(a, b) { return a.key.localeCompare(b.key) })
          for (let fi = 0; fi < feats.length; fi++) {
            const f = feats[fi]
            let line = '- **' + f.key + '** — ' + f.summary + ' _(feature risk: ' + f.featureRisk + ')'
            if (eventDef.phase === 'GA') {
              line += '; FV: ' + (f.fixVersionCommitted ? 'committed' : 'misaligned')
            }
            line += '_'
            lines.push(line)
            if (f.detail) lines.push('  - ' + f.detail)
            if (eventDef.phase === 'GA' && !f.fixVersionCommitted && f.misalignedFixVersions.length) {
              lines.push('  - Misaligned Fix Version(s): ' + f.misalignedFixVersions.join(', '))
            }
          }
          lines.push('')
        }
      }
      if (!anyFailures) {
        lines.push('_No FPDoR failures — all features pass or only N/A items._')
        lines.push('')
      }
    }
  }

  if (report.blockers.length) {
    lines.push('## Blockers / limitations')
    lines.push('')
    for (let i = 0; i < report.blockers.length; i++) {
      lines.push('- ' + report.blockers[i])
    }
    lines.push('')
  }

  return lines.join('\n')
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function riskClass(level) {
  return 'risk-' + String(level || 'low').toLowerCase()
}

function commitmentBadge(feature) {
  if (feature.fixVersionCommitted) {
    return '<span class="badge commit-yes">Committed</span>'
  }
  let detail = 'Not committed'
  if (feature.misalignedFixVersions && feature.misalignedFixVersions.length) {
    detail = 'Misaligned: ' + feature.misalignedFixVersions.join(', ')
  }
  return '<span class="badge commit-no" title="' + escapeHtml(detail) + '">Misaligned</span>'
}

function renderEventProductSections(eventDef, eventBlock) {
  let productSections = ''

  for (let pi = 0; pi < PRODUCTS.length; pi++) {
    const product = PRODUCTS[pi]
    const block = eventBlock.byProduct[product]
    let severitySections = ''
    let anyFailures = false

    for (let si = 0; si < SEVERITY_ORDER.length; si++) {
      const sev = SEVERITY_ORDER[si]
      const items = block.failureIndex[sev] || {}
      const itemNames = Object.keys(items).sort()
      if (itemNames.length === 0) continue
      anyFailures = true

      let itemSections = ''
      for (let ii = 0; ii < itemNames.length; ii++) {
        const itemName = itemNames[ii]
        const feats = items[itemName].slice().sort(function(a, b) { return a.key.localeCompare(b.key) })
        let featureRows = ''
        for (let fi = 0; fi < feats.length; fi++) {
          const f = feats[fi]
          featureRows += '<li class="feature-item">'
            + '<a class="issue-key" href="https://issues.redhat.com/browse/' + escapeHtml(f.key) + '" target="_blank" rel="noopener">' + escapeHtml(f.key) + '</a>'
            + ' <span class="feature-summary">' + escapeHtml(f.summary) + '</span>'
            + ' <span class="badge ' + riskClass(f.featureRisk) + '">' + escapeHtml(f.featureRisk) + '</span>'
          if (eventDef.phase === 'GA') {
            featureRows += commitmentBadge(f)
          }
          if (f.detail) {
            featureRows += '<div class="feature-detail">' + escapeHtml(f.detail) + '</div>'
          }
          if (eventDef.phase === 'GA' && !f.fixVersionCommitted && f.misalignedFixVersions && f.misalignedFixVersions.length) {
            featureRows += '<div class="feature-detail misaligned-fv">' + escapeHtml(f.misalignedFixVersions.join(', ')) + '</div>'
          }
          featureRows += '</li>\n'
        }

        itemSections += '<details class="fpdor-item">'
          + '<summary><span class="severity-badge sev-' + sev + '">' + escapeHtml(sev) + '</span> '
          + escapeHtml(itemName) + ' <span class="count">(' + feats.length + ')</span></summary>'
          + '<ul class="feature-list">' + featureRows + '</ul>'
          + '</details>\n'
      }

      severitySections += '<details class="severity-group" open>'
        + '<summary><span class="severity-badge sev-' + sev + '">' + escapeHtml(sev.charAt(0).toUpperCase() + sev.slice(1)) + '</span></summary>'
        + '<div class="fpdor-items">' + itemSections + '</div>'
        + '</details>\n'
    }

    if (!anyFailures) {
      severitySections = '<p class="no-failures">No FPDoR failures — all features pass or only N/A items.</p>'
    }

    const gaStats = eventDef.phase === 'GA' && block.total > 0
      ? '<span class="commit-yes"><strong>Committed:</strong> ' + block.fixVersionCommitted + '</span>'
        + '<span class="commit-no"><strong>Misaligned:</strong> ' + block.fixVersionMisaligned + '</span>'
      : ''

    productSections += '<details class="product-group" open>'
      + '<summary>'
      + '<span class="product-name">' + escapeHtml(product) + ' — ' + escapeHtml(CYCLE + ' ' + eventDef.phase) + '</span>'
      + ' <span class="badge ' + riskClass(block.risk.level) + '">' + escapeHtml(block.risk.level.toUpperCase()) + '</span>'
      + ' <span class="meta-inline">' + block.total + ' features · freeze ' + escapeHtml(block.planningFreezeDate || 'unknown') + '</span>'
      + '</summary>'
      + '<div class="product-body">'
      + '<div class="product-stats">'
      + '<span><strong>Ready:</strong> ' + block.ready + '</span>'
      + '<span><strong>Not ready:</strong> ' + (block.total - block.ready) + '</span>'
      + '<span class="risk-high"><strong>High:</strong> ' + block.risk.high + '</span>'
      + '<span class="risk-medium"><strong>Medium:</strong> ' + block.risk.medium + '</span>'
      + '<span class="risk-low"><strong>Low:</strong> ' + block.risk.low + '</span>'
      + gaStats
      + '</div>'
      + severitySections
      + '</div></details>\n'
  }

  return productSections
}

function renderEventExecRows(eventDef, eventBlock) {
  let rows = ''
  for (let pi = 0; pi < PRODUCTS.length; pi++) {
    const product = PRODUCTS[pi]
    const block = eventBlock.byProduct[product]
    rows += '<tr>'
      + '<td><strong>' + escapeHtml(product) + '</strong></td>'
      + '<td>' + escapeHtml(block.cohortLabel) + '</td>'
      + '<td>' + escapeHtml(block.assignmentLabel) + '</td>'
      + '<td>' + escapeHtml(block.planningFreezeDate || '—') + '</td>'
      + '<td class="num">' + block.total + '</td>'
      + '<td class="num">' + block.ready + '</td>'
      + (eventDef.phase === 'GA'
        ? '<td class="num commit-yes">' + (block.fixVersionCommitted || 0) + '</td>'
          + '<td class="num commit-no">' + (block.fixVersionMisaligned || 0) + '</td>'
        : '<td class="num muted">—</td><td class="num muted">—</td>')
      + '<td class="num risk-high">' + block.risk.high + '</td>'
      + '<td class="num risk-medium">' + block.risk.medium + '</td>'
      + '<td class="num risk-low">' + block.risk.low + '</td>'
      + '<td><span class="badge ' + riskClass(block.risk.level) + '">' + escapeHtml(block.risk.level.toUpperCase()) + '</span></td>'
      + '</tr>\n'
  }
  return rows
}

function renderEventSummaryCards(eventDef, eventBlock) {
  const totals = eventBlock.totals
  let cards = ''
    + '<div class="card"><div class="label">Features</div><div class="value">' + totals.features + '</div></div>'
    + '<div class="card ready"><div class="label">FPDoR Ready</div><div class="value">' + totals.ready + '</div></div>'
    + '<div class="card high"><div class="label">High Risk</div><div class="value">' + totals.risk.high + '</div></div>'
    + '<div class="card medium"><div class="label">Medium Risk</div><div class="value">' + totals.risk.medium + '</div></div>'
    + '<div class="card low"><div class="label">Low Risk</div><div class="value">' + totals.risk.low + '</div></div>'
  if (eventDef.phase === 'GA') {
    cards += '<div class="card commit"><div class="label">FV Committed</div><div class="value">' + (totals.fixVersionCommitted || 0) + '</div></div>'
      + '<div class="card misaligned"><div class="label">FV Misaligned</div><div class="value">' + (totals.fixVersionMisaligned || 0) + '</div></div>'
  }
  return cards
}

function renderEventTabPanel(eventDef, eventBlock, isFirst) {
  const panelId = 'tabpanel-' + eventDef.key
  const cohortMode = eventDef.cohort === 'passed' ? 'Execute' : 'Plan'
  const freezeDates = PRODUCTS.map(function(p) {
    return p + ': ' + (eventBlock.byProduct[p].planningFreezeDate || '—')
  }).join(' · ')

  const gaNote = eventDef.phase === 'GA'
    ? '<p class="event-note"><strong>Fix Version commitment:</strong> ' + eventBlock.totals.fixVersionCommitted + ' committed, '
      + eventBlock.totals.fixVersionMisaligned + ' TV/FV misaligned.</p>'
    : ''

  return '<div class="tab-panel' + (isFirst ? ' active' : '') + '" id="' + panelId + '" role="tabpanel" tabindex="0" aria-labelledby="tab-' + eventDef.key + '"' + (isFirst ? '' : ' hidden') + '>'
    + '<div class="event-context">'
    + '<h2 class="event-title">' + escapeHtml(eventTabLabel(eventDef)) + '</h2>'
    + '<div class="event-meta">'
    + '<p><strong>Cohort:</strong> ' + escapeHtml(eventDef.cohortLabel) + ' (' + escapeHtml(cohortMode) + ')</p>'
    + '<p><strong>Membership rule:</strong> ' + escapeHtml(eventDef.assignmentLabel) + '</p>'
    + '<p><strong>Planning freeze dates:</strong> ' + escapeHtml(freezeDates) + '</p>'
    + '</div>'
    + '</div>'
    + '<div class="sticky-bar event-sticky">'
    + '<div class="summary-cards">' + renderEventSummaryCards(eventDef, eventBlock) + '</div>'
    + '</div>'
    + '<section class="event-section">'
    + '<h3>Executive summary</h3>'
    + '<table>\n<thead><tr>'
    + '<th>Product</th><th>Cohort</th><th>Assignment</th><th>Freeze</th>'
    + '<th>Features</th><th>Ready</th><th>FV committed</th><th>FV misaligned</th>'
    + '<th>High</th><th>Medium</th><th>Low</th><th>Risk</th>'
    + '</tr></thead>\n<tbody>\n' + renderEventExecRows(eventDef, eventBlock) + '</tbody>\n</table>'
    + gaNote
    + '</section>'
    + '<section class="event-section">'
    + '<h3>Details by product and FPDoR item</h3>'
    + renderEventProductSections(eventDef, eventBlock)
    + '</section>'
    + '</div>\n'
}

function renderHtml(report) {
  const freezeDates = PRODUCTS.map(function(p) {
    const ea2 = report.events.execute.byProduct[p].planningFreezeDate
    const ga = report.events.plan.byProduct[p].planningFreezeDate
    return p + ' EA2: ' + (ea2 || '—') + ', GA: ' + (ga || '—')
  }).join(' · ')

  let tabButtons = ''
  let tabPanels = ''
  for (let ei = 0; ei < EVENTS.length; ei++) {
    const eventDef = EVENTS[ei]
    const eventBlock = report.events[eventDef.key]
    const isFirst = ei === 0
    tabButtons += '<button type="button" class="tab-btn' + (isFirst ? ' active' : '') + '" id="tab-' + eventDef.key + '" role="tab"'
      + ' aria-selected="' + (isFirst ? 'true' : 'false') + '"'
      + ' aria-controls="tabpanel-' + eventDef.key + '"'
      + ' tabindex="' + (isFirst ? '0' : '-1') + '"'
      + ' data-tab="' + eventDef.key + '">'
      + escapeHtml(eventTabLabel(eventDef))
      + '</button>\n'
    tabPanels += renderEventTabPanel(eventDef, eventBlock, isFirst)
  }

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>Feature Risk Report — ' + escapeHtml(CYCLE + ' EA2 + GA') + '</title>\n'
    + '<style>\n'
    + ':root {\n'
    + '  --bg: #f4f6f9;\n'
    + '  --surface: #fff;\n'
    + '  --text: #1a1f2e;\n'
    + '  --muted: #5c6578;\n'
    + '  --border: #d8dee8;\n'
    + '  --high: #c0392b;\n'
    + '  --high-bg: #fdecea;\n'
    + '  --medium: #b86e00;\n'
    + '  --medium-bg: #fff4e0;\n'
    + '  --low: #1e7a45;\n'
    + '  --low-bg: #e8f6ee;\n'
    + '  --critical: #7b1f1f;\n'
    + '  --critical-bg: #f5d5d5;\n'
    + '  --soft: #4a5568;\n'
    + '  --soft-bg: #edf2f7;\n'
    + '  --accent: #2563eb;\n'
    + '  --accent-bg: #eff6ff;\n'
    + '  --commit-yes: #1e7a45;\n'
    + '  --commit-yes-bg: #e8f6ee;\n'
    + '  --commit-no: #9a3412;\n'
    + '  --commit-no-bg: #ffedd5;\n'
    + '}\n'
    + '* { box-sizing: border-box; }\n'
    + 'body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }\n'
    + 'a { color: var(--accent); text-decoration: none; }\n'
    + 'a:hover { text-decoration: underline; }\n'
    + '.page { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }\n'
    + 'header.report-header { margin-bottom: 1rem; }\n'
    + 'header.report-header h1 { margin: 0 0 0.5rem; font-size: 1.75rem; }\n'
    + '.header-meta { color: var(--muted); font-size: 0.9rem; }\n'
    + '.header-meta p { margin: 0.25rem 0; }\n'
    + '.tab-bar { display: flex; flex-wrap: wrap; gap: 0; border-bottom: 2px solid var(--border); margin-bottom: 0; background: var(--surface); border-radius: 8px 8px 0 0; border: 1px solid var(--border); border-bottom: 2px solid var(--border); }\n'
    + '.tab-btn { flex: 1 1 auto; min-width: 200px; padding: 0.85rem 1.25rem; border: none; background: transparent; color: var(--muted); font-size: 0.9rem; font-weight: 600; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: color 0.15s, background 0.15s, border-color 0.15s; text-align: left; }\n'
    + '.tab-btn:hover { color: var(--text); background: var(--accent-bg); }\n'
    + '.tab-btn:focus { outline: 2px solid var(--accent); outline-offset: -2px; }\n'
    + '.tab-btn.active { color: var(--accent); background: var(--accent-bg); border-bottom-color: var(--accent); }\n'
    + '.tab-panels { background: var(--surface); border: 1px solid var(--border); border-top: none; border-radius: 0 0 8px 8px; }\n'
    + '.tab-panel { padding: 0; }\n'
    + '.tab-panel[hidden] { display: none; }\n'
    + '.event-context { padding: 1.25rem 1.25rem 0.75rem; border-bottom: 1px solid var(--border); background: #fafbfc; }\n'
    + '.event-title { margin: 0 0 0.5rem; font-size: 1.2rem; }\n'
    + '.event-meta { color: var(--muted); font-size: 0.88rem; }\n'
    + '.event-meta p { margin: 0.2rem 0; }\n'
    + '.sticky-bar { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.97); backdrop-filter: blur(6px); border-bottom: 1px solid var(--border); padding: 0.75rem 1.25rem; }\n'
    + '.summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.75rem; }\n'
    + '.card { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.65rem 0.85rem; }\n'
    + '.card .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }\n'
    + '.card .value { font-size: 1.35rem; font-weight: 700; margin-top: 0.1rem; }\n'
    + '.card.high .value { color: var(--high); }\n'
    + '.card.medium .value { color: var(--medium); }\n'
    + '.card.low .value { color: var(--low); }\n'
    + '.card.ready .value { color: var(--accent); }\n'
    + '.card.commit .value { color: var(--commit-yes); }\n'
    + '.card.misaligned .value { color: var(--commit-no); }\n'
    + '.event-section { padding: 1.25rem; border-bottom: 1px solid var(--border); }\n'
    + '.event-section:last-child { border-bottom: none; }\n'
    + '.event-section h3 { margin: 0 0 1rem; font-size: 1.05rem; }\n'
    + '.event-note { margin: 0.75rem 0 0; color: var(--muted); font-size: 0.88rem; }\n'
    + 'section.global-section { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin: 1.25rem 0; }\n'
    + 'section.global-section h2 { margin: 0 0 1rem; font-size: 1.15rem; }\n'
    + 'table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }\n'
    + 'th, td { padding: 0.55rem 0.65rem; text-align: left; border-bottom: 1px solid var(--border); }\n'
    + 'th { background: #f8fafc; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }\n'
    + 'td.num { text-align: right; font-variant-numeric: tabular-nums; }\n'
    + 'td.muted { color: var(--muted); }\n'
    + '.rules-table td:first-child { width: 6rem; }\n'
    + '.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }\n'
    + '.badge.risk-high { background: var(--high-bg); color: var(--high); }\n'
    + '.badge.risk-medium { background: var(--medium-bg); color: var(--medium); }\n'
    + '.badge.risk-low { background: var(--low-bg); color: var(--low); }\n'
    + '.badge.commit-yes { background: var(--commit-yes-bg); color: var(--commit-yes); }\n'
    + '.badge.commit-no { background: var(--commit-no-bg); color: var(--commit-no); }\n'
    + '.risk-high { color: var(--high); }\n'
    + '.risk-medium { color: var(--medium); }\n'
    + '.risk-low { color: var(--low); }\n'
    + '.commit-yes { color: var(--commit-yes); }\n'
    + '.commit-no { color: var(--commit-no); }\n'
    + '.severity-badge { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }\n'
    + '.sev-critical { background: var(--critical-bg); color: var(--critical); }\n'
    + '.sev-high { background: var(--high-bg); color: var(--high); }\n'
    + '.sev-medium { background: var(--medium-bg); color: var(--medium); }\n'
    + '.sev-soft { background: var(--soft-bg); color: var(--soft); }\n'
    + 'details { margin: 0.5rem 0; }\n'
    + 'summary { cursor: pointer; padding: 0.5rem 0.65rem; border-radius: 6px; list-style-position: outside; font-weight: 600; }\n'
    + 'summary:hover { background: #f8fafc; }\n'
    + 'details > summary::-webkit-details-marker { color: var(--muted); }\n'
    + '.product-group > summary { font-size: 1rem; border-left: 4px solid var(--accent); padding-left: 0.85rem; }\n'
    + '.product-name { font-weight: 700; }\n'
    + '.meta-inline { font-weight: 400; color: var(--muted); font-size: 0.85rem; margin-left: 0.5rem; }\n'
    + '.product-body { padding: 0.5rem 0 0.5rem 1rem; }\n'
    + '.product-stats { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.85rem; margin-bottom: 0.75rem; padding: 0.5rem 0.65rem; background: #f8fafc; border-radius: 6px; }\n'
    + '.severity-group { border-left: 3px solid var(--border); margin-left: 0.5rem; padding-left: 0.5rem; }\n'
    + '.fpdor-item { border: 1px solid var(--border); border-radius: 6px; margin: 0.4rem 0; background: #fafbfc; }\n'
    + '.fpdor-item > summary { font-weight: 600; font-size: 0.9rem; }\n'
    + '.fpdor-item .count { color: var(--muted); font-weight: 400; }\n'
    + '.feature-list { margin: 0; padding: 0.5rem 1rem 0.75rem 2rem; list-style: none; }\n'
    + '.feature-item { padding: 0.45rem 0; border-top: 1px solid var(--border); font-size: 0.88rem; }\n'
    + '.feature-item:first-child { border-top: none; }\n'
    + '.issue-key { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }\n'
    + '.feature-summary { margin: 0 0.35rem; }\n'
    + '.feature-detail { margin-top: 0.25rem; color: var(--muted); font-size: 0.82rem; padding-left: 0.25rem; border-left: 2px solid var(--border); }\n'
    + '.feature-detail.misaligned-fv { color: var(--commit-no); border-left-color: var(--commit-no); }\n'
    + '.no-failures { color: var(--muted); font-style: italic; margin: 0.5rem 0; }\n'
    + '.blockers ul { margin: 0; padding-left: 1.25rem; }\n'
    + '.portfolio-summary { color: var(--muted); font-size: 0.9rem; margin: 0.5rem 0 0; }\n'
    + '@media (max-width: 700px) { .page { padding: 1rem; } .tab-btn { min-width: 100%; font-size: 0.82rem; } table { font-size: 0.8rem; } }\n'
    + '</style>\n</head>\n<body>\n<div class="page">\n'
    + '<header class="report-header">\n'
    + '<h1>Feature Risk Report — ' + escapeHtml(CYCLE + ' EA2 + GA') + '</h1>\n'
    + '<div class="header-meta">\n'
    + '<p><strong>Generated:</strong> ' + escapeHtml(report.generatedAt) + '</p>\n'
    + '<p><strong>Evaluation date:</strong> ' + escapeHtml(report.evalDate) + '</p>\n'
    + '<p><strong>Data source:</strong> Live Jira (RHAISTRAT + AIPCC, open Features/Initiatives)</p>\n'
    + '<p><strong>Planning freeze dates:</strong> ' + escapeHtml(freezeDates) + '</p>\n'
    + '<p><strong>Feature placements:</strong> ' + report.totals.features + ' (unique issues: ' + report.totals.uniqueIssues + ')</p>\n'
    + '<p class="portfolio-summary"><strong>Portfolio:</strong> ' + report.totals.ready + ' FPDoR-ready; '
    + report.totals.risk.high + ' high / ' + report.totals.risk.medium + ' medium / ' + report.totals.risk.low + ' low feature risk.</p>\n'
    + '</div>\n</header>\n'
    + '<div class="tab-container" role="tablist" aria-label="Release events">\n'
    + '<div class="tab-bar">' + tabButtons + '</div>\n'
    + '<div class="tab-panels">' + tabPanels + '</div>\n'
    + '</div>\n'
    + '<section class="global-section" id="risk-rules">\n'
    + '<h2>Feature risk rules</h2>\n'
    + '<table class="rules-table"><tbody>\n'
    + '<tr><td><span class="badge risk-high">High</span></td><td>Any critical FPDoR fail, or 2+ high-severity fails</td></tr>\n'
    + '<tr><td><span class="badge risk-medium">Medium</span></td><td>Exactly one high fail, or any medium fail (no critical)</td></tr>\n'
    + '<tr><td><span class="badge risk-low">Low</span></td><td>All pass, or only soft-severity fails</td></tr>\n'
    + '</tbody></table>\n</section>\n'
    + (report.blockers && report.blockers.length
      ? '<section class="global-section blockers" id="blockers"><h2>Blockers / limitations</h2><ul>'
        + report.blockers.map(function(b) { return '<li>' + escapeHtml(b) + '</li>' }).join('\n')
        + '</ul></section>'
      : '')
    + '</div>\n'
    + '<script>\n'
    + '(function() {\n'
    + '  var tabs = document.querySelectorAll(".tab-btn");\n'
    + '  var panels = document.querySelectorAll(".tab-panel");\n'
    + '  function activateTab(key) {\n'
    + '    tabs.forEach(function(tab) {\n'
    + '      var isActive = tab.getAttribute("data-tab") === key;\n'
    + '      tab.classList.toggle("active", isActive);\n'
    + '      tab.setAttribute("aria-selected", isActive ? "true" : "false");\n'
    + '      tab.setAttribute("tabindex", isActive ? "0" : "-1");\n'
    + '    });\n'
    + '    panels.forEach(function(panel) {\n'
    + '      var isActive = panel.id === "tabpanel-" + key;\n'
    + '      panel.classList.toggle("active", isActive);\n'
    + '      if (isActive) { panel.removeAttribute("hidden"); } else { panel.setAttribute("hidden", ""); }\n'
    + '    });\n'
    + '  }\n'
    + '  tabs.forEach(function(tab) {\n'
    + '    tab.addEventListener("click", function() { activateTab(tab.getAttribute("data-tab")); });\n'
    + '    tab.addEventListener("keydown", function(e) {\n'
    + '      var idx = Array.prototype.indexOf.call(tabs, tab);\n'
    + '      var next = -1;\n'
    + '      if (e.key === "ArrowRight" || e.key === "ArrowDown") { next = (idx + 1) % tabs.length; }\n'
    + '      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { next = (idx - 1 + tabs.length) % tabs.length; }\n'
    + '      else if (e.key === "Home") { next = 0; }\n'
    + '      else if (e.key === "End") { next = tabs.length - 1; }\n'
    + '      if (next >= 0) { e.preventDefault(); tabs[next].focus(); activateTab(tabs[next].getAttribute("data-tab")); }\n'
    + '    });\n'
    + '  });\n'
    + '})();\n'
    + '</script>\n'
    + '</body>\n</html>\n'
}

function collectPlacements(raw, epicCounts) {
  const placements = []
  const seen = new Set()

  for (let i = 0; i < raw.issues.length; i++) {
    const issue = raw.issues[i]
    const fields = issue.fields || {}
    const targetVersionNames = versionNamesFromField(fields.customfield_10855)
    const fixVersionNames = versionNamesFromField(fields.fixVersions)
    const record = toFeatureRecord(issue, epicCounts)
    const fpdor = computeFPDoRReadiness(record)
    const featureRisk = computeFeatureRisk(fpdor)
    const ready = !!fpdor.allApplicablePassed

    for (let ei = 0; ei < EVENTS.length; ei++) {
      const event = EVENTS[ei]
      for (let pi = 0; pi < PRODUCTS.length; pi++) {
        const product = PRODUCTS[pi]
        const vn = versionName(event.phase, product)
        const inCohort = event.assignmentField === 'fixVersion'
          ? fixVersionNames.indexOf(vn) !== -1
          : targetVersionNames.indexOf(vn) !== -1
        if (!inCohort) continue

        const placementKey = issue.key + '|' + event.key + '|' + product
        if (seen.has(placementKey)) continue
        seen.add(placementKey)

        const alignment = event.phase === 'GA'
          ? fixVersionAlignment(fixVersionNames, event.phase, product)
          : { fixVersionCommitted: null, misalignedFixVersions: [] }

        placements.push({
          key: issue.key,
          eventKey: event.key,
          phase: event.phase,
          product: product,
          title: record.summary,
          status: record.status,
          deliveryOwner: record.assignee,
          pmOwner: record.pmOwner,
          targetVersions: record.targetVersions,
          fixVersions: record.fixVersions,
          labels: record.labels,
          fpdor: fpdor,
          featureRisk: featureRisk,
          ready: ready,
          fixVersionCommitted: alignment.fixVersionCommitted,
          misalignedFixVersions: alignment.misalignedFixVersions
        })
      }
    }
  }

  return placements
}

function main() {
  const rawPath = path.join(DATA_DIR, 'jira-3.6-ea2-raw.json')
  if (!fs.existsSync(rawPath)) {
    console.error('Missing input:', rawPath)
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'))
  const freezes = loadProductPagesFreezes()
  const blockers = []

  for (let pi = 0; pi < PRODUCTS.length; pi++) {
    const product = PRODUCTS[pi]
    if (!freezes[product]) freezes[product] = {}
    for (let ei = 0; ei < EVENTS.length; ei++) {
      const event = EVENTS[ei]
      if (!freezes[product][event.phase]) {
        blockers.push('Product Pages cache missing ' + product + ' ' + event.phase + '; using default freeze date.')
        freezes[product][event.phase] = defaultFreeze(product, event.phase)
      }
    }
  }

  const epicCounts = loadEpicCounts()
  if (Object.keys(epicCounts).length === 0) {
    blockers.push('Child epic counts not enriched — run epic Jira batch fetch to produce scripts/feature-risk-report/data/jira-3.6-ea2-epic-counts.json.')
  } else {
    blockers.push('Child epic counts enriched via Jira parent/Epic Link query (' + Object.keys(epicCounts).length + ' features with child epics).')
  }

  const placements = collectPlacements(raw, epicCounts)
  const uniqueIssueKeys = new Set(placements.map(function(p) { return p.key }))

  const events = {}
  for (let ei = 0; ei < EVENTS.length; ei++) {
    const event = EVENTS[ei]
    events[event.key] = buildEventBlock(event, placements, freezes)
  }

  let totalReady = 0
  let totalHigh = 0
  let totalMedium = 0
  let totalLow = 0
  for (let ei = 0; ei < EVENTS.length; ei++) {
    const t = events[EVENTS[ei].key].totals
    totalReady += t.ready
    totalHigh += t.risk.high
    totalMedium += t.risk.medium
    totalLow += t.risk.low
  }

  const report = {
    generatedAt: new Date().toISOString(),
    evalDate: EVAL_DATE,
    cycle: CYCLE,
    eventDefinitions: EVENTS.map(function(e) {
      return {
        key: e.key,
        phase: e.phase,
        tabLabel: eventTabLabel(e),
        cohort: e.cohort,
        cohortLabel: e.cohortLabel,
        assignmentField: e.assignmentField,
        assignmentLabel: e.assignmentLabel
      }
    }),
    products: PRODUCTS,
    totals: {
      features: placements.length,
      uniqueIssues: uniqueIssueKeys.size,
      ready: totalReady,
      risk: { high: totalHigh, medium: totalMedium, low: totalLow }
    },
    events: events,
    blockers: blockers
  }

  const mdPath = path.join(DATA_DIR, 'feature-risk-report-3.6.md')
  const jsonPath = path.join(DATA_DIR, 'feature-risk-report-3.6.json')
  const htmlPath = path.join(DATA_DIR, 'feature-risk-report-3.6.html')
  fs.writeFileSync(mdPath, renderMarkdown(report))
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  fs.writeFileSync(htmlPath, renderHtml(report))

  console.log('Wrote', mdPath)
  console.log('Wrote', jsonPath)
  console.log('Wrote', htmlPath)
  console.log('Stats:', JSON.stringify(report.totals))
  console.log('3.6 EA2 (Fix Version):', JSON.stringify(events.execute.totals))
  console.log('3.6 GA (Target Version):', JSON.stringify(events.plan.totals))
  for (let pi = 0; pi < PRODUCTS.length; pi++) {
    const p = PRODUCTS[pi]
    const ea2 = events.execute.byProduct[p]
    const ga = events.plan.byProduct[p]
    console.log(p + ' EA2:', ea2.total, 'features; GA:', ga.total, 'features (' + ga.fixVersionCommitted + ' committed)')
  }
}

function htmlFromJson() {
  const jsonPath = path.join(DATA_DIR, 'feature-risk-report-3.6.json')
  const htmlPath = path.join(DATA_DIR, 'feature-risk-report-3.6.html')
  if (!fs.existsSync(jsonPath)) {
    console.error('Missing input:', jsonPath)
    process.exit(1)
  }
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  fs.writeFileSync(htmlPath, renderHtml(report))
  console.log('Wrote', htmlPath)
}

if (process.argv.indexOf('--html-only') !== -1) {
  htmlFromJson()
} else {
  main()
}
