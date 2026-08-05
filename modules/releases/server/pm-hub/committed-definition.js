/**
 * PM Hub "Committed" classification.
 *
 * Requested = Target Version intersects selected release scope (handled by caller).
 * Committed = Fix Version intersects selected release scope AND some Target Version
 *   either matches that Fix Version, or is later in the same release cycle
 *   (early delivery). Same cycle = same product + major.minor; milestone order
 *   EA1 < EA2 < GA via tv-fv-delta parse/compare helpers.
 */

const {
  parseReleaseName,
  compareReleasesTemporally
} = require('../tv-fv-delta/routes')

/**
 * True when both names parse to the same product + major.minor.
 */
function sameReleaseCycle(a, b) {
  var pa = parseReleaseName(a)
  var pb = parseReleaseName(b)
  if (!pa || !pb) return false
  return pa.product === pb.product && pa.major === pb.major && pa.minor === pb.minor
}

/**
 * Whether a Target Version supports treating `fv` as Committed.
 * Match (same version) or early delivery (TV later in same cycle).
 */
function tvSupportsCommittedFixVersion(fv, tvNames) {
  if (!fv || !Array.isArray(tvNames) || tvNames.length === 0) return false

  for (var i = 0; i < tvNames.length; i++) {
    var tv = tvNames[i]
    if (!tv) continue

    // Exact string match (covers unparseable but identical labels)
    if (tv === fv) return true

    if (!sameReleaseCycle(fv, tv)) continue

    // compareReleasesTemporally: negative = FV earlier than TV, 0 = same
    var cmp = compareReleasesTemporally(fv, tv)
    if (cmp !== null && cmp <= 0) return true
  }

  return false
}

/**
 * Filter selected-scope Fix Versions down to those that qualify as Committed
 * given the issue's Target Versions.
 *
 * @param {string[]} matchingFv - Fix Versions that intersect the selected scope
 * @param {string[]} tvNames - All Target Versions on the issue
 * @returns {string[]} subset of matchingFv that are Committed
 */
function filterCommittedFixVersions(matchingFv, tvNames) {
  if (!Array.isArray(matchingFv) || matchingFv.length === 0) return []
  var out = []
  for (var i = 0; i < matchingFv.length; i++) {
    if (tvSupportsCommittedFixVersion(matchingFv[i], tvNames)) {
      out.push(matchingFv[i])
    }
  }
  return out
}

module.exports = {
  sameReleaseCycle,
  tvSupportsCommittedFixVersion,
  filterCommittedFixVersions,
  parseReleaseName,
  compareReleasesTemporally
}
