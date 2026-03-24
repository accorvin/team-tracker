/**
 * Formatting and aggregation helpers for metrics display
 */

/**
 * Format a number as a percentage string
 */
export function formatPercent(value) {
  if (value == null || isNaN(value)) return '--'
  return `${Math.round(value)}%`
}

/**
 * Format a number with optional decimal places
 */
export function formatNumber(value, decimals = 0) {
  if (value == null || isNaN(value)) return '--'
  return Number(value).toFixed(decimals)
}

/**
 * Format a date string as locale date
 */
export function formatDate(dateString) {
  if (!dateString) return '--'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Format a date range
 */
export function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return '--'
  return `${formatDate(startDate)} - ${formatDate(endDate)}`
}

/**
 * Get the month key for a date (e.g., "2026-01")
 */
export function getMonthKey(dateString) {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Format a month key as a label (e.g., "Jan 2026")
 */
export function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/**
 * Aggregate sprint-level data into monthly buckets
 */
export function aggregateToMonthlyBuckets(sprintData) {
  const buckets = {}

  for (const sprint of sprintData) {
    const endDate = sprint.endDate || sprint.completeDate
    if (!endDate) continue
    const key = getMonthKey(endDate)

    if (!buckets[key]) {
      buckets[key] = {
        month: key,
        label: formatMonthLabel(key),
        velocityPoints: 0,
        velocityCount: 0,
        committedPoints: 0,
        deliveredPoints: 0,
        sprintCount: 0
      }
    }

    const b = buckets[key]
    b.velocityPoints += sprint.velocityPoints || 0
    b.velocityCount += sprint.velocityCount || 0
    b.committedPoints += sprint.committedPoints || 0
    b.deliveredPoints += sprint.deliveredPoints || 0
    b.sprintCount += 1
  }

  return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month))
}
