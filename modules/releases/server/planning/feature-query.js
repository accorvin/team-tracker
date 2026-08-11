var { CUSTOM_FIELDS, serializeField, numericField } = require('../hygiene/jira-fetch')
var { parseDescriptionSignals } = require('./health/description-scanner')

var QUERY_FIELDS = [
  'summary', 'status', 'issuetype', 'assignee', 'fixVersions',
  'components', 'labels', 'priority', 'created', 'updated',
  'description',
  CUSTOM_FIELDS.team,
  CUSTOM_FIELDS.targetVersion,
  CUSTOM_FIELDS.riceScore,
  CUSTOM_FIELDS.statusSummary,
  CUSTOM_FIELDS.colorStatus,
  CUSTOM_FIELDS.releaseType,
  CUSTOM_FIELDS.docsRequired,
  CUSTOM_FIELDS.targetEnd,
  CUSTOM_FIELDS.productManager,
  CUSTOM_FIELDS.effort
].join(',')

var JQL = 'project = RHAISTRAT AND issuetype IN (Feature, Initiative) AND status NOT IN (Closed, Done, Resolved, Cancelled)'

var EPIC_BATCH_SIZE = 40
var EPIC_THROTTLE_MS = 500

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms) })
}

function normalizeIssue(issue) {
  var fields = issue.fields || {}
  var assignee = fields.assignee
    ? (typeof fields.assignee === 'object' ? fields.assignee.displayName || null : fields.assignee)
    : null
  var components = Array.isArray(fields.components)
    ? fields.components.map(function(c) { return c.name || String(c) }).filter(Boolean)
    : []
  var fixVersions = Array.isArray(fields.fixVersions)
    ? fields.fixVersions.map(function(v) { return v.name || String(v) }).filter(Boolean)
    : []
  var labels = Array.isArray(fields.labels) ? fields.labels : []
  var targetVersionRaw = serializeField(fields[CUSTOM_FIELDS.targetVersion])
  var targetVersions = targetVersionRaw ? [targetVersionRaw] : []
  var status = fields.status
    ? (typeof fields.status === 'object' ? fields.status.name || null : fields.status)
    : null
  var priority = fields.priority
    ? (typeof fields.priority === 'object' ? fields.priority.name || null : fields.priority)
    : null
  var issueType = fields.issuetype
    ? (typeof fields.issuetype === 'object' ? fields.issuetype.name || null : fields.issuetype)
    : null

  var pmOwnerField = fields[CUSTOM_FIELDS.productManager]
  var pmOwner = pmOwnerField
    ? (typeof pmOwnerField === 'object' ? pmOwnerField.displayName || null : pmOwnerField)
    : null

  return {
    key: issue.key,
    summary: fields.summary || '',
    status: status,
    issueType: issueType,
    assignee: assignee,
    team: serializeField(fields[CUSTOM_FIELDS.team]),
    components: components,
    labels: labels,
    fixVersions: fixVersions,
    targetVersions: targetVersions,
    priority: priority,
    riceScore: numericField(fields[CUSTOM_FIELDS.riceScore]),
    statusSummary: serializeField(fields[CUSTOM_FIELDS.statusSummary]),
    colorStatus: serializeField(fields[CUSTOM_FIELDS.colorStatus]),
    releaseType: serializeField(fields[CUSTOM_FIELDS.releaseType]),
    docsRequired: serializeField(fields[CUSTOM_FIELDS.docsRequired]),
    targetEnd: serializeField(fields[CUSTOM_FIELDS.targetEnd]),
    pmOwner: pmOwner,
    effort: numericField(fields[CUSTOM_FIELDS.effort]),
    descriptionSignals: parseDescriptionSignals(fields.description),
    epicCount: null
  }
}

/**
 * Count Epic children linked via parent / Epic Link for each feature key.
 * Matches Confluence Child epics DoR (Child Issues section).
 *
 * @param {object} jiraClient
 * @param {Map<string, object>} featureMap
 */
async function enrichChildEpicCounts(jiraClient, featureMap) {
  if (!jiraClient || !jiraClient.fetchAllJqlResults || !featureMap || featureMap.size === 0) return

  var keys = Array.from(featureMap.keys())
  for (var start = 0; start < keys.length; start += EPIC_BATCH_SIZE) {
    if (start > 0) await sleep(EPIC_THROTTLE_MS)
    var batchKeys = keys.slice(start, start + EPIC_BATCH_SIZE)
    var keyList = batchKeys.map(function(k) { return '"' + k + '"' }).join(', ')
    // Epic type only — Confluence: "Linked child epics in engineering projects"
    var jql = 'issuetype = Epic AND (parent in (' + keyList + ') OR "Epic Link" in (' + keyList + '))'
    try {
      var children = await jiraClient.fetchAllJqlResults(jql, 'parent,customfield_10014', { maxResults: 100 })
      for (var i = 0; i < children.length; i++) {
        var fields = children[i].fields || {}
        var parentKey = (fields.parent && fields.parent.key) || fields.customfield_10014 || null
        if (!parentKey || !featureMap.has(parentKey)) continue
        var feat = featureMap.get(parentKey)
        feat.epicCount = (feat.epicCount || 0) + 1
      }
    } catch (err) {
      console.warn(
        '[releases/planning] Child epic count batch ' +
          (Math.floor(start / EPIC_BATCH_SIZE) + 1) +
          ' failed: ' +
          (err && err.message ? err.message : err)
      )
    }
  }
}

async function fetchFeatures(jiraClient) {
  if (!jiraClient || !jiraClient.fetchAllJqlResults) return new Map()

  var issues = await jiraClient.fetchAllJqlResults(JQL, QUERY_FIELDS, { maxResults: 100 })
  var map = new Map()
  for (var i = 0; i < issues.length; i++) {
    var normalized = normalizeIssue(issues[i])
    if (normalized.key) map.set(normalized.key, normalized)
  }
  // Do not run enrichChildEpicCounts here — batched live Jira searches over all
  // open Features timeout the /feature-readiness gateway (HTTP 504). Keep the
  // helper exported for offline/pipeline use; mergeFeatureData still prefers
  // jira.epicCount when present.
  return map
}

module.exports = {
  fetchFeatures: fetchFeatures,
  normalizeIssue: normalizeIssue,
  enrichChildEpicCounts: enrichChildEpicCounts,
  JQL: JQL,
  QUERY_FIELDS: QUERY_FIELDS
}
