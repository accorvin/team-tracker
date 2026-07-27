/**
 * Merge per-release TV/FV detail buckets across multiple product versions
 * (e.g. 3.6 EA1 RHOAI + RHAII + RHELAI) into one view, deduping by issue key.
 *
 * @param {Record<string, {
 *   aligned_on_time?: object[],
 *   aligned_late?: object[],
 *   tv_only?: object[],
 *   fv_only?: object[],
 *   misaligned?: object[],
 * }>|null|undefined} releasesMap
 * @param {string[]} names
 * @returns {{
 *   aligned_on_time: object[],
 *   aligned_late: object[],
 *   tv_only: object[],
 *   fv_only: object[],
 *   misaligned: object[],
 * }|null}
 */
export function mergeReleaseDetails(releasesMap, names) {
  if (!releasesMap || !names || !names.length) return null

  var cats = ['aligned_on_time', 'aligned_late', 'tv_only', 'fv_only', 'misaligned']
  var out = {
    aligned_on_time: [],
    aligned_late: [],
    tv_only: [],
    fv_only: [],
    misaligned: [],
  }
  var seen = {
    aligned_on_time: {},
    aligned_late: {},
    tv_only: {},
    fv_only: {},
    misaligned: {},
  }
  var any = false

  for (var i = 0; i < names.length; i++) {
    var rd = releasesMap[names[i]]
    if (!rd) continue
    any = true
    for (var ci = 0; ci < cats.length; ci++) {
      var cat = cats[ci]
      // Fall back to pre-5-category bucket names if present
      var list = rd[cat] || []
      if (!list.length && cat === 'aligned_on_time' && Array.isArray(rd.aligned)) list = rd.aligned
      if (!list.length && cat === 'misaligned' && Array.isArray(rd.mismatched)) list = rd.mismatched
      for (var fi = 0; fi < list.length; fi++) {
        var feat = list[fi]
        var key = feat && feat.key
        if (!key || seen[cat][key]) continue
        seen[cat][key] = true
        out[cat].push(feat)
      }
    }
  }

  return any ? out : null
}
