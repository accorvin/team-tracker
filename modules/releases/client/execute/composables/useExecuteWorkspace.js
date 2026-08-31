import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { mergeExecuteFeatures } from '../helpers/merge-execute-features.js'

function emptyPayload() {
  return {
    features: [],
    groups: [],
    planningFreezeDate: null,
    fetchedAt: null,
    trackingFetchedAt: null,
    hygieneFetchedAt: null,
    executionFetchedAt: null
  }
}

async function fetchJsonSafe(path) {
  try {
    return await apiRequest(path)
  } catch {
    return null
  }
}

function tagHygiene(featuresMap, family) {
  var tagged = {}
  var keys = Object.keys(featuresMap || {})
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    var feat = featuresMap[key] || {}
    tagged[key] = Object.assign({}, feat, { _family: family || null })
  }
  return tagged
}

function uniquePortfolioVersions(specs) {
  var versions = []
  var seen = {}
  for (var i = 0; i < specs.length; i++) {
    var pv = specs[i] && specs[i].portfolioVersion
    if (!pv || seen[pv]) continue
    seen[pv] = true
    versions.push(pv)
  }
  return versions
}

function selectedFamiliesFromSpecs(specs) {
  var families = []
  var seen = {}
  for (var i = 0; i < specs.length; i++) {
    var fam = specs[i] && specs[i].family
    if (!fam || seen[fam]) continue
    seen[fam] = true
    families.push(fam)
  }
  return families
}

function earliestTimestamp(values) {
  var oldest = null
  for (var i = 0; i < values.length; i++) {
    if (!values[i]) continue
    if (!oldest || new Date(values[i]) < new Date(oldest)) oldest = values[i]
  }
  return oldest
}

export function useExecuteWorkspace() {
  var loading = ref(false)
  var error = ref(null)
  var payload = ref(emptyPayload())

  var features = computed(function () { return payload.value.features })
  var groups = computed(function () { return payload.value.groups })
  var planningFreezeDate = computed(function () { return payload.value.planningFreezeDate })
  var fetchedAt = computed(function () { return payload.value.fetchedAt })

  /**
   * @param {{ portfolioVersion: string, family: string|null, jiraName: string|null }[]} specs
   *   Gear-driven load specs from buildReleaseSpecs().
   * @param {{ refreshTracking?: boolean }} [opts]
   */
  async function loadWorkspace(specs, opts) {
    var skipTrackingCache = opts && opts.refreshTracking

    if (!specs || specs.length === 0) {
      payload.value = emptyPayload()
      error.value = null
      return payload.value
    }

    loading.value = true
    error.value = null

    try {
      var portfolios = uniquePortfolioVersions(specs)
      var trackingPromises = portfolios.map(function (pv) {
        var trackingUrl = '/modules/releases/execution/tracking/data?version=' + encodeURIComponent(pv)
        if (skipTrackingCache) trackingUrl += '&refresh=true'
        return fetchJsonSafe(trackingUrl)
      })

      var perSpec = specs.map(function (spec) {
        if (!spec.jiraName) {
          return Promise.resolve({ family: spec.family, hygiene: null, execution: null })
        }
        return Promise.all([
          fetchJsonSafe('/modules/releases/hygiene/features?version=' + encodeURIComponent(spec.jiraName)),
          fetchJsonSafe('/modules/releases/execution/features?version=' + encodeURIComponent(spec.jiraName))
        ]).then(function (pair) {
          return {
            family: spec.family,
            hygiene: pair[0],
            execution: pair[1]
          }
        })
      })

      var trackingResults = await Promise.all(trackingPromises)
      var specResults = await Promise.all(perSpec)

      var trackingGroups = []
      var freezeDates = []
      var trackingFetched = []
      for (var t = 0; t < trackingResults.length; t++) {
        var tracking = trackingResults[t]
        if (!tracking) continue
        var groupsForVersion = tracking.groups || []
        for (var g = 0; g < groupsForVersion.length; g++) trackingGroups.push(groupsForVersion[g])
        if (tracking.planningFreezeDate) freezeDates.push(tracking.planningFreezeDate)
        if (tracking.fetchedAt) trackingFetched.push(tracking.fetchedAt)
      }

      var hygieneByKey = {}
      var execByKey = {}
      var oldestHygiene = null
      var oldestExec = null

      for (var i = 0; i < specResults.length; i++) {
        var row = specResults[i]
        var hyData = row.hygiene
        if (hyData && hyData.features) {
          Object.assign(hygieneByKey, tagHygiene(hyData.features, row.family))
          if (hyData.fetchedAt && (!oldestHygiene || new Date(hyData.fetchedAt) < new Date(oldestHygiene))) {
            oldestHygiene = hyData.fetchedAt
          }
        }
        var execList = (row.execution && row.execution.features) || []
        for (var j = 0; j < execList.length; j++) {
          if (execList[j] && execList[j].key) execByKey[execList[j].key] = execList[j]
        }
        var execFetched = row.execution && row.execution.fetchedAt
        if (execFetched && (!oldestExec || new Date(execFetched) < new Date(oldestExec))) {
          oldestExec = execFetched
        }
      }

      var merged = mergeExecuteFeatures({
        trackingGroups: trackingGroups,
        hygieneFeatures: hygieneByKey,
        executionFeatures: Object.values(execByKey),
        selectedFamilies: selectedFamiliesFromSpecs(specs)
      })

      var trackingFetchedAt = earliestTimestamp(trackingFetched)
      var oldest = earliestTimestamp([oldestHygiene, oldestExec, trackingFetchedAt])

      payload.value = {
        features: merged.features,
        groups: merged.groups,
        planningFreezeDate: earliestTimestamp(freezeDates),
        fetchedAt: oldest,
        trackingFetchedAt: trackingFetchedAt,
        hygieneFetchedAt: oldestHygiene,
        executionFetchedAt: oldestExec
      }
      return payload.value
    } catch (err) {
      error.value = err.message
      payload.value = emptyPayload()
      return payload.value
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    features,
    groups,
    planningFreezeDate,
    fetchedAt,
    payload,
    loadWorkspace
  }
}
