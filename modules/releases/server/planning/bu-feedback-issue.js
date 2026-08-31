/**
 * Helpers for extracting process-efficiency timestamps from Jira changelog
 * on BU/SSA feedback issues.
 */

var IN_PROGRESS_STATUSES = [
  'in progress', 'in review', 'review', 'coding',
  'development', 'in development', 'testing', 'qa'
]

/**
 * Walk changelog histories oldest-first and return the ISO timestamp of
 * the first transition into an in-progress-like status.
 *
 * @param {object|null} changelog - Jira issue changelog (from expand=changelog)
 * @returns {string|null} ISO timestamp or null
 */
function extractFirstInProgressAt(changelog) {
  if (!changelog || !Array.isArray(changelog.histories)) return null

  var histories = changelog.histories.slice().sort(function(a, b) {
    if (a.created < b.created) return -1
    if (a.created > b.created) return 1
    return 0
  })

  for (var i = 0; i < histories.length; i++) {
    var items = histories[i].items || []
    for (var j = 0; j < items.length; j++) {
      var item = items[j]
      if (item.field === 'status' && item.toString) {
        if (IN_PROGRESS_STATUSES.indexOf(item.toString.toLowerCase()) !== -1) {
          return histories[i].created
        }
      }
    }
  }

  return null
}

/**
 * Recursively extract plain text from a Jira ADF (Atlassian Document Format) node.
 * @param {object|string|null} node
 * @returns {string}
 */
var BLOCK_CONTAINERS = ['doc', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'panel', 'decisionList', 'taskList']

function extractAdfText(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractAdfText).join('')
  if (node.type === 'text') return node.text || ''
  if (node.type === 'hardBreak') return '\n'
  if (Array.isArray(node.content)) {
    var sep = BLOCK_CONTAINERS.indexOf(node.type) !== -1 ? '\n' : ''
    return node.content.map(extractAdfText).join(sep)
  }
  return ''
}

var CUSTOMER_RE = /customer:\s*(.+)/i

/**
 * Scan all comments on an issue for "customer: <name>" lines.
 * Returns a comma-separated string of unique customer names (or '').
 *
 * @param {object|null} commentField - raw.fields.comment from Jira search
 * @returns {string}
 */
function extractCustomersFromComments(commentField) {
  if (!commentField || !Array.isArray(commentField.comments)) return ''

  var seen = {}
  var customers = []

  for (var i = 0; i < commentField.comments.length; i++) {
    var body = commentField.comments[i].body
    if (!body) continue

    var text = extractAdfText(body)
    var lines = text.split('\n')
    for (var j = 0; j < lines.length; j++) {
      var match = lines[j].match(CUSTOMER_RE)
      if (match) {
        var names = match[1].split(',')
        for (var k = 0; k < names.length; k++) {
          var name = names[k].trim()
          if (name && !seen[name.toLowerCase()]) {
            seen[name.toLowerCase()] = true
            customers.push(name)
          }
        }
      }
    }
  }

  return customers.join(', ')
}

module.exports = { extractFirstInProgressAt, IN_PROGRESS_STATUSES, extractAdfText, extractCustomersFromComments }
