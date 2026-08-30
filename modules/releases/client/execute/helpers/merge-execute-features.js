/**
 * Join tracking, hygiene, and execution feature records by Jira key.
 *
 * Membership is tracking-only (current Features plus dropped). Hygiene and
 * execution are overlays on those keys. Missing overlays are left empty
 * (null / [] / 0). Rows that exist only in hygiene or execution are omitted
 * so Table, Board, and Signals share one list that matches tracking JQL.
 */

var OTHER_PRODUCT = 'other'

function firstNonEmpty() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i]
    if (v == null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    return v
  }
  return null
}

function mergeOne(tracking, hygiene, execution, product) {
  var hy = hygiene || {}
  var tr = tracking || {}
  var ex = execution || {}
  var key = hy.key || tr.key || ex.key
  var violations = Array.isArray(hy.violations) ? hy.violations : []
  var components = firstNonEmpty(hy.components, tr.components, ex.components) || []
  var isBlocked = !!(tr.isBlocked || hy.isBlocked || (ex.blockerCount > 0))

  return {
    key: key,
    summary: firstNonEmpty(hy.summary, tr.summary, ex.summary) || '',
    issueType: firstNonEmpty(hy.issueType, tr.issueType, ex.issueType),
    status: firstNonEmpty(hy.status, ex.status, tr.status),
    statusCategory: firstNonEmpty(hy.statusCategory, ex.statusCategory, tr.statusCategory),
    assignee: firstNonEmpty(hy.assignee, tr.assignee, ex.assignee),
    reporter: hy.reporter || null,
    team: firstNonEmpty(hy.team, tr.team, ex.team),
    components: Array.isArray(components) ? components : [],
    labels: firstNonEmpty(hy.labels, ex.labels) || [],
    fixVersions: firstNonEmpty(hy.fixVersions, ex.fixVersions) || [],
    targetVersions: hy.targetVersions || ex.targetVersions || [],
    colorStatus: firstNonEmpty(hy.colorStatus, tr.colorStatus, ex.colorStatus, ex.ownerStatusColor),
    ownerStatusColor: firstNonEmpty(ex.ownerStatusColor, hy.colorStatus, tr.colorStatus),
    statusSummary: firstNonEmpty(hy.statusSummary, tr.statusSummary),
    pmOwner: firstNonEmpty(tr.pmOwner, hy.pmOwner),
    priority: firstNonEmpty(hy.priority, ex.priority),
    isBlocked: isBlocked,
    blockedBy: hy.blockedBy || [],
    scopeChange: tr.scopeChange || null,
    fixVersionAddedAt: tr.fixVersionAddedAt || null,
    fixVersionRemovedAt: tr.fixVersionRemovedAt || null,
    violations: violations,
    completionPct: typeof ex.completionPct === 'number' ? ex.completionPct : null,
    epicCount: typeof ex.epicCount === 'number' ? ex.epicCount : 0,
    issueCount: typeof ex.issueCount === 'number' ? ex.issueCount : 0,
    blockerCount: typeof ex.blockerCount === 'number' ? ex.blockerCount : 0,
    health: ex.health || null,
    lastUpdated: firstNonEmpty(ex.lastUpdated, hy.updated, tr.updated),
    signoffStatus: ex.signoffStatus || null,
    product: product || OTHER_PRODUCT,
    missingTargetVersion: hy.missingTargetVersion,
    targetReleaseId: hy.targetReleaseId || null,
    fixReleaseId: hy.fixReleaseId || null,
    url: hy.url || tr.url || (key ? 'https://redhat.atlassian.net/browse/' + key : null)
  }
}

/**
 * @param {object} opts
 * @param {object[]} [opts.trackingGroups]
 * @param {object} [opts.hygieneFeatures] Map of key → hygiene feature
 * @param {object[]} [opts.executionFeatures]
 * @param {string[]} [opts.selectedFamilies] Lowercase product families to keep
 * @returns {{ features: object[], groups: object[] }}
 */
export function mergeExecuteFeatures(opts) {
  var trackingGroups = (opts && opts.trackingGroups) || []
  var hygieneByKey = (opts && opts.hygieneFeatures) || {}
  var executionFeatures = (opts && opts.executionFeatures) || []
  var selectedFamilies = (opts && opts.selectedFamilies) || []
  var familySet = {}
  for (var i = 0; i < selectedFamilies.length; i++) {
    familySet[String(selectedFamilies[i]).toLowerCase()] = true
  }
  var hasFamilyFilter = selectedFamilies.length > 0

  var execByKey = {}
  for (var e = 0; e < executionFeatures.length; e++) {
    var ef = executionFeatures[e]
    if (ef && ef.key) execByKey[ef.key] = ef
  }

  var trackingByKey = {}
  var trackingProductByKey = {}
  var keptTrackingGroups = []
  for (var g = 0; g < trackingGroups.length; g++) {
    var group = trackingGroups[g]
    var product = String(group.product || '').toLowerCase()
    if (hasFamilyFilter && product && !familySet[product]) continue
    keptTrackingGroups.push(group)
    var feats = group.features || []
    for (var f = 0; f < feats.length; f++) {
      var tf = feats[f]
      if (!tf || !tf.key) continue
      trackingByKey[tf.key] = tf
      trackingProductByKey[tf.key] = product || OTHER_PRODUCT
    }
  }

  var mergedByKey = {}
  var keys = Object.keys(trackingByKey)
  for (var ki = 0; ki < keys.length; ki++) {
    var key = keys[ki]
    var hy = hygieneByKey[key] || null
    var mergedProduct = trackingProductByKey[key] || OTHER_PRODUCT
    mergedByKey[key] = mergeOne(trackingByKey[key], hy, execByKey[key], String(mergedProduct).toLowerCase())
  }

  var groups = []
  for (var gi = 0; gi < keptTrackingGroups.length; gi++) {
    var src = keptTrackingGroups[gi]
    var mergedFeats = []
    var srcFeats = src.features || []
    for (var sj = 0; sj < srcFeats.length; sj++) {
      var srcKey = srcFeats[sj] && srcFeats[sj].key
      if (!srcKey || !mergedByKey[srcKey]) continue
      mergedFeats.push(mergedByKey[srcKey])
    }
    var liveCount = 0
    for (var lc = 0; lc < mergedFeats.length; lc++) {
      if (mergedFeats[lc].scopeChange !== 'dropped') liveCount++
    }
    groups.push({
      label: src.label,
      product: String(src.product || OTHER_PRODUCT).toLowerCase(),
      releaseNumber: src.releaseNumber,
      planningFreezeDate: src.planningFreezeDate || null,
      featureCount: liveCount,
      features: mergedFeats
    })
  }

  var features = Object.keys(mergedByKey).map(function (k) { return mergedByKey[k] })
  features.sort(function (a, b) {
    if (a.key < b.key) return -1
    if (a.key > b.key) return 1
    return 0
  })

  return { features: features, groups: groups }
}

export { OTHER_PRODUCT }
