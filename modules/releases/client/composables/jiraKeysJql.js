/**
 * Build a Jira issue-search URL for the exact keys shown in a TV/FV section.
 * Used when category logic cannot be expressed in JQL (aligned late / misaligned)
 * or when multiple products are merged into one view.
 */

var JIRA_ISSUES = 'https://redhat.atlassian.net/issues/?jql='

/** Soft cap — keeps URLs under common browser/proxy limits while covering typical sections */
var MAX_KEYS = 400

/**
 * @param {Array<{ key?: string }>|null|undefined} features
 * @returns {string} Jira URL, or '' when there are no keys
 */
export function buildKeysJqlUrl(features) {
  if (!features || !features.length) return ''

  var keys = []
  var seen = {}
  for (var i = 0; i < features.length; i++) {
    var key = features[i] && features[i].key
    if (!key || seen[key]) continue
    seen[key] = true
    keys.push(key)
    if (keys.length >= MAX_KEYS) break
  }
  if (!keys.length) return ''

  return JIRA_ISSUES + encodeURIComponent('key in (' + keys.join(', ') + ')')
}
