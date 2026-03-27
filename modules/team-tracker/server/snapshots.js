/**
 * Monthly metric snapshots for teams and people.
 *
 * Generates point-in-time snapshots of team and person metrics,
 * stored in data/snapshots/<sanitized-teamKey>/<YYYY-MM>.json.
 *
 * Periods are calendar months starting from Jan 2026.
 */

const SNAPSHOT_EPOCH = new Date('2026-01-01T00:00:00Z');

/**
 * Generate the list of calendar month periods from the epoch up to today.
 * Each period is { start: Date, end: Date, monthKey: "YYYY-MM" }.
 */
function getSnapshotPeriods() {
  const periods = [];
  const now = new Date();
  let cursor = new Date(SNAPSHOT_EPOCH);

  while (cursor < now) {
    const start = new Date(cursor);
    const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const monthKey = start.toISOString().slice(0, 7); // "YYYY-MM"
    periods.push({ start, end, monthKey });
    cursor = end;
  }

  return periods;
}

/**
 * Get the current period (the one that contains today).
 * Returns null if today is before the epoch.
 */
function getCurrentPeriod() {
  const periods = getSnapshotPeriods();
  if (periods.length === 0) return null;
  return periods[periods.length - 1];
}

/**
 * Get all completed periods (whose end date is in the past).
 */
function getCompletedPeriods() {
  const now = new Date();
  return getSnapshotPeriods().filter(p => p.end <= now);
}

/**
 * Format a date as YYYY-MM-DD for use as storage key.
 */
function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Sanitize a team key for use in file paths.
 * Replaces :: with -- and removes other special chars.
 */
function sanitizeTeamKey(teamKey) {
  return teamKey.replace(/::/g, '--').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Build the storage path for a snapshot.
 */
function snapshotPath(teamKey, periodEnd) {
  return `snapshots/${sanitizeTeamKey(teamKey)}/${formatDate(periodEnd)}.json`;
}

/**
 * Get a user's monthly contribution count, handling both nested and flat formats.
 * Production format: { months: { "2026-01": 72 }, fetchedAt: "..." }
 * Legacy flat format: { "2026-01": 72 }
 * Returns null if no history data is available (triggers fallback to cache).
 */
function getMonthlyContribution(userHistory, monthKey) {
  if (!userHistory) return null;
  // Production format: monthly data nested under "months" key
  if (userHistory.months && typeof userHistory.months === 'object') {
    return userHistory.months[monthKey] || 0;
  }
  // Legacy flat format: monthly data directly on the user object
  if (monthKey in userHistory) {
    return userHistory[monthKey] || 0;
  }
  return null;
}

/**
 * Generate a snapshot for a team for a given period.
 *
 * @param {object} storage - Storage context with readFromStorage, writeToStorage, listStorageFiles
 * @param {string} teamKey - Composite key like "orgKey::teamName"
 * @param {object} team - Team object with members array
 * @param {object} period - { start: Date, end: Date, monthKey: "YYYY-MM" }
 * @param {object} [options] - Optional github/gitlab caches and history
 * @returns {object} The generated snapshot
 */
function generateSnapshot(storage, teamKey, team, period, options = {}) {
  const { readFromStorage } = storage;
  const githubHistory = options.githubHistory || readFromStorage('github-history.json') || { users: {} };
  const gitlabHistory = options.gitlabHistory || readFromStorage('gitlab-history.json') || { users: {} };
  // Fallback caches used only when history data is unavailable for a user
  const githubCache = options.githubCache || readFromStorage('github-contributions.json') || { users: {} };
  const gitlabCache = options.gitlabCache || readFromStorage('gitlab-contributions.json') || { users: {} };

  const seen = new Set();
  const uniqueMembers = team.members.filter(m => {
    if (seen.has(m.jiraDisplayName)) return false;
    seen.add(m.jiraDisplayName);
    return true;
  });

  let totalResolved = 0;
  let totalPoints = 0;
  let cycleTimes = [];
  let totalGithub = 0;
  let totalGitlab = 0;
  const members = {};

  const periodStartStr = formatDate(period.start);
  const periodEndStr = formatDate(period.end);
  const monthKey = period.monthKey || period.start.toISOString().slice(0, 7);

  for (const member of uniqueMembers) {
    const key = member.jiraDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const cached = readFromStorage(`people/${key}.json`);

    // Filter resolved issues to this period's date range
    const allIssues = cached?.resolved?.issues || [];
    const periodIssues = allIssues.filter(issue => {
      if (!issue.resolutionDate) return false;
      const rd = issue.resolutionDate.slice(0, 10);
      return rd >= periodStartStr && rd < periodEndStr;
    });

    const resolvedCount = periodIssues.length;
    const resolvedPoints = periodIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    const issueCycleTimes = periodIssues
      .filter(i => i.cycleTimeDays != null)
      .map(i => i.cycleTimeDays);
    const avgCycleTimeDays = issueCycleTimes.length > 0
      ? +(issueCycleTimes.reduce((a, b) => a + b, 0) / issueCycleTimes.length).toFixed(1)
      : null;

    // GitHub: use monthly history if available, fall back to total
    const ghUserHistory = member.githubUsername ? (githubHistory.users?.[member.githubUsername] || null) : null;
    const ghMonthly = getMonthlyContribution(ghUserHistory, monthKey);
    const ghContrib = member.githubUsername
      ? (ghMonthly !== null ? ghMonthly
        : (githubCache.users?.[member.githubUsername]?.totalContributions ?? 0))
      : 0;

    // GitLab: use monthly history if available, fall back to total
    const glUserHistory = member.gitlabUsername ? (gitlabHistory.users?.[member.gitlabUsername] || null) : null;
    const glMonthly = getMonthlyContribution(glUserHistory, monthKey);
    const glContrib = member.gitlabUsername
      ? (glMonthly !== null ? glMonthly
        : (gitlabCache.users?.[member.gitlabUsername]?.totalContributions ?? 0))
      : 0;

    const memberSnapshot = {
      resolvedCount,
      resolvedPoints,
      avgCycleTimeDays,
      githubContributions: ghContrib,
      gitlabContributions: glContrib,
      hasGithub: !!member.githubUsername,
      hasGitlab: !!member.gitlabUsername
    };

    members[member.jiraDisplayName] = memberSnapshot;

    totalResolved += resolvedCount;
    totalPoints += resolvedPoints;
    totalGithub += ghContrib;
    totalGitlab += glContrib;
    if (avgCycleTimeDays != null) {
      cycleTimes.push(avgCycleTimeDays);
    }
  }

  const avgCycleTimeDays = cycleTimes.length > 0
    ? +(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length).toFixed(1)
    : null;

  const snapshot = {
    periodStart: formatDate(period.start),
    periodEnd: formatDate(period.end),
    generatedAt: new Date().toISOString(),
    team: {
      resolvedCount: totalResolved,
      resolvedPoints: totalPoints,
      avgCycleTimeDays,
      githubContributions: totalGithub,
      gitlabContributions: totalGitlab
    },
    members
  };

  return snapshot;
}

/**
 * Generate and store a snapshot if one doesn't already exist for the period.
 * Returns the snapshot (existing or newly generated).
 */
function generateAndStoreSnapshot(storage, teamKey, team, period) {
  const { readFromStorage, writeToStorage } = storage;
  const path = snapshotPath(teamKey, period.end);

  const existing = readFromStorage(path);
  if (existing) return existing;

  const snapshot = generateSnapshot(storage, teamKey, team, period);
  writeToStorage(path, snapshot);
  return snapshot;
}

/**
 * Load all snapshots for a team, sorted by period start date.
 */
function loadTeamSnapshots(storage, teamKey) {
  const { listStorageFiles, readFromStorage } = storage;
  const dir = `snapshots/${sanitizeTeamKey(teamKey)}`;
  const files = listStorageFiles(dir);
  const snapshots = [];

  for (const file of files) {
    try {
      const data = readFromStorage(`${dir}/${file}`);
      if (data) snapshots.push(data);
    } catch {
      // skip malformed files
    }
  }

  snapshots.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  return snapshots;
}

/**
 * Load snapshots for a specific person within a team.
 */
function loadPersonSnapshots(storage, teamKey, personName) {
  const allSnapshots = loadTeamSnapshots(storage, teamKey);
  return allSnapshots.map(s => ({
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    generatedAt: s.generatedAt,
    metrics: s.members[personName] || null
  })).filter(s => s.metrics !== null);
}

module.exports = {
  getSnapshotPeriods,
  getCurrentPeriod,
  getCompletedPeriods,
  generateSnapshot,
  generateAndStoreSnapshot,
  loadTeamSnapshots,
  loadPersonSnapshots,
  snapshotPath,
  formatDate,
  sanitizeTeamKey,
  SNAPSHOT_EPOCH
};
