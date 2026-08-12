var { CUSTOM_FIELDS, serializeField, numericField } = require('../hygiene/jira-fetch')
var { parseDescriptionSignals } = require('./health/description-scanner')
var { fetchEpicsForFeatures } = require('../execution/jira-enrich')

var QUERY_FIELDS = [
  'summary', 'status', 'issuetype', 'assignee', 'fixVersions',
  'components', 'labels', 'priority', 'created', 'updated',
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

/** Bound live Jira so /feature-readiness stays under the gateway timeout. */
var FETCH_FEATURES_TIMEOUT_MS = 12000

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
    // null when description was not fetched — lets health/cache signals win in merge
    descriptionSignals: fields.description ? parseDescriptionSignals(fields.description) : null
    // Do not set epicCount here — live fetch does not discover child Epics.
    // A placeholder 0 would override exec/health counts in mergeFeatureData.
  }
}

/**
 * Count Epic children linked via parent / Epic Link for each feature key.
 * Delegates to execution fetchEpicsForFeatures — offline / pipeline use only.
 * Do not call from GET /feature-readiness (gateway timeout).
 *
 * @param {object} jiraClient
 * @param {Map<string, object>} featureMap
 */
async function enrichChildEpicCounts(jiraClient, featureMap) {
  if (!jiraClient || !jiraClient.fetchAllJqlResults || !featureMap || featureMap.size === 0) return

  var keys = Array.from(featureMap.keys())
  var epicMap = await fetchEpicsForFeatures(keys, null, function(jql, fields, opts) {
    return jiraClient.fetchAllJqlResults(jql, fields, opts)
  })
  epicMap.forEach(function(epics, parentKey) {
    if (!featureMap.has(parentKey)) return
    featureMap.get(parentKey).epicCount = Array.isArray(epics) ? epics.length : 0
  })
}

async function fetchFeatures(jiraClient) {
  if (!jiraClient || !jiraClient.fetchAllJqlResults) return new Map()

  var issues = await jiraClient.fetchAllJqlResults(JQL, QUERY_FIELDS, { maxResults: 100 })
  var map = new Map()
  for (var i = 0; i < issues.length; i++) {
    var normalized = normalizeIssue(issues[i])
    if (normalized.key) map.set(normalized.key, normalized)
  }
  // Child epic counts come from execution store (fullJiraSync → feature.epics).
  // Live enrichChildEpicCounts on this path caused Features List HTTP 504.
  return map
}

/**
 * Like fetchFeatures, but abandons the wait after timeoutMs so the Features List
 * can respond from execution/health cache instead of gateway-timing-out.
 * The underlying Jira fetch may still complete in the background.
 *
 * @param {object} jiraClient
 * @param {number} [timeoutMs]
 * @returns {Promise<Map|null>} feature map, or null on timeout / empty / missing client
 */
async function fetchFeaturesWithTimeout(jiraClient, timeoutMs) {
  if (!jiraClient || !jiraClient.fetchAllJqlResults) return null
  var ms = timeoutMs != null ? timeoutMs : FETCH_FEATURES_TIMEOUT_MS
  var timedOut = false
  var timeout = new Promise(function(resolve) {
    setTimeout(function() {
      timedOut = true
      resolve(null)
    }, ms)
  })
  var result = await Promise.race([fetchFeatures(jiraClient), timeout])
  if (timedOut || result == null) {
    if (timedOut) {
      console.warn(
        '[releases/planning] Live Jira feature fetch exceeded ' + ms + 'ms; using cached readiness sources'
      )
    }
    return null
  }
  if (result.size === 0) return null
  return result
}

module.exports = {
  fetchFeatures: fetchFeatures,
  fetchFeaturesWithTimeout: fetchFeaturesWithTimeout,
  normalizeIssue: normalizeIssue,
  enrichChildEpicCounts: enrichChildEpicCounts,
  JQL: JQL,
  QUERY_FIELDS: QUERY_FIELDS,
  FETCH_FEATURES_TIMEOUT_MS: FETCH_FEATURES_TIMEOUT_MS
}
