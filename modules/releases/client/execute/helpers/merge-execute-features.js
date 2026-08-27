/**
 * Join tracking, hygiene, and execution feature records by Jira key.
 *
 * Missing overlays are left empty (null / [] / 0) so Table, Board, and Signals
 * can share one feature list without dropping records that exist in only one
 * source.
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

function familyOf(hygiene, trackingProduct) {
  if (trackingProduct) return String(trackingProduct).toLowerCase()
  if (hygiene && hygiene._family) return String(hygiene._family).toLowerCase()
  return null
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

  var allKeys = {}
  var hk = Object.keys(hygieneByKey)
  for (var hi = 0; hi < hk.length; hi++) allKeys[hk[hi]] = true
  var tk = Object.keys(trackingByKey)
  for (var ti = 0; ti < tk.length; ti++) allKeys[tk[ti]] = true
  var ek = Object.keys(execByKey)
  for (var ei = 0; ei < ek.length; ei++) allKeys[ek[ei]] = true

  var mergedByKey = {}
  var keys = Object.keys(allKeys)
  for (var ki = 0; ki < keys.length; ki++) {
    var key = keys[ki]
    var hy = hygieneByKey[key] || null
    var fam = familyOf(hy, trackingProductByKey[key])
    if (hasFamilyFilter && hy && fam && !familySet[fam] && !trackingByKey[key] && !execByKey[key]) {
      continue
    }
    if (hasFamilyFilter && hy && fam && !familySet[fam] && !trackingByKey[key]) {
      // Hygiene record for a family outside the selector — skip unless execution also has it
      // (execution is already version-scoped by the caller).
      if (!execByKey[key]) continue
    }
    var mergedProduct = trackingProductByKey[key] || (hy && hy._family) || OTHER_PRODUCT
    mergedByKey[key] = mergeOne(trackingByKey[key], hy, execByKey[key], String(mergedProduct).toLowerCase())
  }

  var used = {}
  var groups = []
  for (var gi = 0; gi < keptTrackingGroups.length; gi++) {
    var src = keptTrackingGroups[gi]
    var mergedFeats = []
    var srcFeats = src.features || []
    for (var sj = 0; sj < srcFeats.length; sj++) {
      var srcKey = srcFeats[sj] && srcFeats[sj].key
      if (!srcKey || !mergedByKey[srcKey]) continue
      mergedFeats.push(mergedByKey[srcKey])
      used[srcKey] = true
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

  var leftoversByProduct = {}
  var leftoverKeys = Object.keys(mergedByKey)
  for (var li = 0; li < leftoverKeys.length; li++) {
    var lkey = leftoverKeys[li]
    if (used[lkey]) continue
    var leftover = mergedByKey[lkey]
    var lp = leftover.product || OTHER_PRODUCT
    if (!leftoversByProduct[lp]) leftoversByProduct[lp] = []
    leftoversByProduct[lp].push(leftover)
  }

  var leftoverProducts = Object.keys(leftoversByProduct)
  leftoverProducts.sort()
  for (var lpIdx = 0; lpIdx < leftoverProducts.length; lpIdx++) {
    var p = leftoverProducts[lpIdx]
    var extra = leftoversByProduct[p]
    var existing = null
    for (var eg = 0; eg < groups.length; eg++) {
      if (groups[eg].product === p) {
        existing = groups[eg]
        break
      }
    }
    if (existing) {
      existing.features = existing.features.concat(extra)
      var extraLive = 0
      for (var el = 0; el < extra.length; el++) {
        if (extra[el].scopeChange !== 'dropped') extraLive++
      }
      existing.featureCount += extraLive
    } else {
      var newLive = 0
      for (var nl = 0; nl < extra.length; nl++) {
        if (extra[nl].scopeChange !== 'dropped') newLive++
      }
      groups.push({
        label: p === OTHER_PRODUCT ? 'Other' : p.toUpperCase(),
        product: p,
        releaseNumber: '',
        planningFreezeDate: null,
        featureCount: newLive,
        features: extra
      })
    }
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
