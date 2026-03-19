/**
 * Fetch GitLab contribution stats via the authenticated REST API (/api/v4/users/:id/events).
 *
 * Single-pass: fetches events once per user and returns both total counts
 * and monthly breakdown. Supports incremental fetching (only new events
 * since last fetch) and caches username→ID resolution.
 *
 * Uses node-fetch (v2) for HTTP requests.
 */

const fetch = require('node-fetch');

const GITLAB_BASE_URL = process.env.GITLAB_BASE_URL || 'https://gitlab.com';
const GITLAB_TOKEN = process.env.GITLAB_TOKEN || null;
// Authenticated: ~300 req/min (~5 req/sec). Use 4 req/sec with safety margin.
// Unauthenticated: ~10 req/min.
const MAX_REQUESTS_PER_SEC = GITLAB_TOKEN ? 4 : 0.14;
const DEFAULT_CONCURRENCY = GITLAB_TOKEN ? 3 : 1;

if (!GITLAB_TOKEN) {
  console.warn('[gitlab] WARNING: GITLAB_TOKEN not set. Rate limit is ~10 req/min unauthenticated.');
  console.warn('[gitlab] Set GITLAB_TOKEN in .env for authenticated access to private project contributions.');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildHeaders() {
  const headers = { Accept: 'application/json' };
  if (GITLAB_TOKEN) headers['PRIVATE-TOKEN'] = GITLAB_TOKEN;
  return headers;
}

/**
 * Create a shared rate limiter that enforces a maximum request rate.
 * All concurrent workers share a single limiter instance.
 */
function createRateLimiter(maxPerSecond) {
  const minIntervalMs = 1000 / maxPerSecond;
  let lastRequestTime = 0;
  let pending = Promise.resolve();

  return function acquire() {
    pending = pending.then(async () => {
      const now = Date.now();
      const elapsed = now - lastRequestTime;
      if (elapsed < minIntervalMs) {
        await delay(minIntervalMs - elapsed);
      }
      lastRequestTime = Date.now();
    });
    return pending;
  };
}

/**
 * Resolve a GitLab username to a numeric user ID via the REST API.
 * Uses the provided cache to avoid repeated lookups.
 * @returns {number|null} user ID or null if not found
 */
async function resolveUserId(username, userIdCache, rateLimiter) {
  if (userIdCache[username]) return userIdCache[username];

  await rateLimiter();
  const url = `${GITLAB_BASE_URL}/api/v4/users?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, { headers: buildHeaders(), timeout: 10000 });
  if (!res.ok) return null;
  const users = await res.json();
  if (users.length > 0) {
    userIdCache[username] = users[0].id;
    return users[0].id;
  }
  return null;
}

/**
 * Fetch events for a user, optionally only since a given date.
 * @param {number} userId
 * @param {string|null} sinceDate - ISO date string; if set, only fetch events after this date
 * @param {Function} rateLimiter
 * @returns {Array} flat list of event objects
 */
async function fetchEvents(userId, sinceDate, rateLimiter) {
  const afterDate = sinceDate
    ? sinceDate.slice(0, 10)
    : (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); })();

  const events = [];
  let page = 1;
  while (true) {
    await rateLimiter();
    const url = `${GITLAB_BASE_URL}/api/v4/users/${userId}/events?per_page=100&page=${page}&after=${afterDate}`;
    const res = await fetch(url, { headers: buildHeaders(), timeout: 15000 });
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    events.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return events;
}

/**
 * Bucket events by month ("YYYY-MM").
 */
function bucketByMonth(events) {
  const months = {};
  for (const event of events) {
    const monthKey = event.created_at.slice(0, 7);
    months[monthKey] = (months[monthKey] || 0) + 1;
  }
  return months;
}

/**
 * Merge incremental monthly data into existing monthly data.
 * The boundary month (containing sinceDate) and all newer months use
 * the fresh count directly (replace), since we can't distinguish
 * which events within the boundary month are truly new.
 * Older months keep their existing counts.
 *
 * @param {object} existing - { "YYYY-MM": count }
 * @param {object} fresh - { "YYYY-MM": count }
 * @param {string} sinceDate - ISO date string marking the fetch boundary
 */
function mergeMonths(existing, fresh, sinceDate) {
  const merged = { ...existing };
  const boundaryMonth = sinceDate ? sinceDate.slice(0, 7) : null;

  for (const [month, count] of Object.entries(fresh)) {
    if (boundaryMonth && month >= boundaryMonth) {
      // Boundary month or newer: replace with fresh count
      merged[month] = count;
    } else {
      // Older than boundary: should not happen with correct sinceDate,
      // but add defensively in case of overlap
      merged[month] = (merged[month] || 0) + count;
    }
  }
  return merged;
}

/**
 * Fetch GitLab data (contributions + history) for a list of usernames.
 * Single-pass: fetches events once and derives both total count and monthly breakdown.
 *
 * @param {string[]} usernames - GitLab usernames to query
 * @param {object} [options]
 * @param {object} [options.existingData] - Map of username -> { totalContributions, months, fetchedAt }
 *   for incremental fetching. If a user has existing data, only fetches events since fetchedAt.
 * @param {object} [options.userIdCache] - Mutable map of username -> numeric GitLab user ID
 * @param {number} [options.concurrency] - Number of concurrent workers (default 3 authenticated, 1 unauth)
 * @returns {Object} Map of username -> { totalContributions, months, fetchedAt } or null
 */
async function fetchGitlabData(usernames, options = {}) {
  const existingData = options.existingData || {};
  const userIdCache = options.userIdCache || {};
  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;
  const rateLimiter = createRateLimiter(MAX_REQUESTS_PER_SEC);

  console.log(`[gitlab] Fetching data for ${usernames.length} users (concurrency: ${concurrency})`);

  const results = {};
  let idx = 0;
  let completed = 0;

  async function worker() {
    while (idx < usernames.length) {
      const i = idx++;
      const username = usernames[i];

      try {
        const userId = await resolveUserId(username, userIdCache, rateLimiter);
        if (!userId) {
          console.log(`[gitlab] User not found: ${username}`);
          results[username] = null;
          completed++;
          continue;
        }

        const existing = existingData[username];
        const sinceDate = existing?.fetchedAt || null;
        const events = await fetchEvents(userId, sinceDate, rateLimiter);
        const freshMonths = bucketByMonth(events);
        const now = new Date().toISOString();

        if (sinceDate && existing) {
          // Incremental: merge with existing data
          const mergedMonths = mergeMonths(existing.months || {}, freshMonths, sinceDate);
          const totalContributions = Object.values(mergedMonths).reduce((a, b) => a + b, 0);
          results[username] = { totalContributions, months: mergedMonths, fetchedAt: now };
        } else {
          // Full fetch
          const totalContributions = events.length;
          results[username] = { totalContributions, months: freshMonths, fetchedAt: now };
        }

        completed++;
        console.log(`[gitlab] ${username}: ${results[username].totalContributions} contributions (${completed}/${usernames.length})`);
      } catch (err) {
        console.error(`[gitlab] Error fetching ${username}:`, err.message);
        results[username] = null;
        completed++;
      }
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(concurrency, usernames.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

module.exports = { fetchGitlabData };
