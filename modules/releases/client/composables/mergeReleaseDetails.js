/**
 * Merge per-release TV/FV detail buckets across multiple product versions
 * (e.g. 3.6 EA1 RHOAI + RHAII + RHELAI) into one view, deduping by issue key.
 *
 * @param {Record<string, { aligned?: object[], tv_only?: object[], fv_only?: object[], mismatched?: object[] }>|null|undefined} releasesMap
 * @param {string[]} names
 * @returns {{ aligned: object[], tv_only: object[], fv_only: object[], mismatched: object[] }|null}
 */
export function mergeReleaseDetails(releasesMap, names) {
  if (!releasesMap || !names || !names.length) return null

  var cats = ['aligned', 'tv_only', 'fv_only', 'mismatched']
  var out = { aligned: [], tv_only: [], fv_only: [], mismatched: [] }
  var seen = { aligned: {}, tv_only: {}, fv_only: {}, mismatched: {} }
  var any = false

  for (var i = 0; i < names.length; i++) {
    var rd = releasesMap[names[i]]
    if (!rd) continue
    any = true
    for (var ci = 0; ci < cats.length; ci++) {
      var cat = cats[ci]
      var list = rd[cat] || []
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
