/**
 * Client-side phase filter utility.
 *
 * Determines whether a feature should appear in a given phase tab
 * based on its fix version strings. A feature passes the filter when
 * at least one of its fix versions contains both the release version
 * (e.g., "3.5") AND the phase label (e.g., "EA1"), case-insensitively
 * and regardless of separator (dot, dash, space, or none).
 *
 * Features without a matching phase-specific fix version do NOT appear
 * in individual phase tabs — only in the "All Features" view.
 */

function splitCommaString(str) {
  if (!str || typeof str !== 'string') return []
  return str.split(',').map(function(s) { return s.trim() }).filter(Boolean)
}

/**
 * @param {object} feature - Feature object with fixVersions or fixVersion
 * @param {string} version - Release version (e.g., '3.5')
 * @param {string|null} phase - Selected phase (EA1/EA2/GA) or null
 * @returns {boolean}
 */
export function passesPhaseFilter(feature, version, phase) {
  if (!phase) return true

  var fixVersionStr = feature.fixVersions || feature.fixVersion || ''
  var fixVersions = splitCommaString(fixVersionStr)

  if (fixVersions.length === 0) return false

  var phaseUpper = phase.toUpperCase()
  var versionUpper = (version || '').toUpperCase()

  for (var i = 0; i < fixVersions.length; i++) {
    var fv = fixVersions[i].toUpperCase()
    if (fv.indexOf(versionUpper) !== -1 && fv.indexOf(phaseUpper) !== -1) {
      return true
    }
  }

  return false
}
