/**
 * Client helpers for TV/FV Delta alignment categories (PM Hub).
 * Keep labels/help in sync with server tv-fv-delta/alignment.js and TvFvDeltaView COLUMN_HELP.
 */

export var ALIGNMENT_CATEGORY_PRIORITY = {
  misaligned: 4,
  tv_only: 3,
  fv_only: 2,
  aligned_late: 1,
  aligned_on_time: 0
}

export var ALIGNMENT_CATEGORY_LABELS = {
  aligned_on_time: 'On time',
  aligned_late: 'Late',
  misaligned: 'Misaligned',
  tv_only: 'TV only',
  fv_only: 'FV only'
}

export var ALIGNMENT_CATEGORY_HELP = {
  aligned_on_time: 'Fix Version matches Target Version, or ships earlier than planned.',
  aligned_late: 'Fix Version is later than Target Version, but planning freeze for that Target Version has already passed — accepted slip.',
  misaligned: 'Fix Version slips past Target Version before planning freeze, or TV/FV point at different products (for example RHOAI vs RHAII).',
  tv_only: 'Target Version is set for this release, but Fix Version is empty.',
  fv_only: 'Fix Version is set for this release, but Target Version is empty.'
}

export function isAlignedCategory(category) {
  return category === 'aligned_on_time' || category === 'aligned_late'
}

export function alignmentCategoryLabel(category) {
  if (!category) return '—'
  return ALIGNMENT_CATEGORY_LABELS[category] || category
}

export function alignmentCategoryHelp(category) {
  if (!category) return 'No Target Version or Fix Version in this release scope.'
  return ALIGNMENT_CATEGORY_HELP[category] || ''
}

export function worseAlignmentCategory(a, b) {
  if (!a) return b || null
  if (!b) return a
  var ra = ALIGNMENT_CATEGORY_PRIORITY[a]
  var rb = ALIGNMENT_CATEGORY_PRIORITY[b]
  if (ra === undefined) return b
  if (rb === undefined) return a
  return ra >= rb ? a : b
}

export function alignmentCategoryChipClass(category) {
  switch (category) {
    case 'aligned_on_time':
      return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
    case 'aligned_late':
      return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
    case 'misaligned':
      return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
    case 'tv_only':
      return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
    case 'fv_only':
      return 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
  }
}
