/**
 * Person-level Jira metrics via JQL
 *
 * Fetches resolved and in-progress issues for a given Jira display name,
 * then computes aggregate metrics (counts, story points, cycle time).
 */

const STORY_POINTS_FIELD = process.env.JIRA_STORY_POINTS_FIELD || 'customfield_12310243';

const FIELDS = `summary,issuetype,status,assignee,resolutiondate,created,components,${STORY_POINTS_FIELD}`;

/**
 * Fetch paginated JQL results (all pages).
 */
async function fetchAllJqlResults(jiraRequest, jql, fields, maxResults = 100) {
  const issues = [];
  let startAt = 0;

  while (true) {
    const params = new URLSearchParams({
      jql,
      fields,
      startAt: String(startAt),
      maxResults: String(maxResults)
    });

    const data = await jiraRequest(`/rest/api/2/search?${params}`);
    if (!data.issues || data.issues.length === 0) break;

    issues.push(...data.issues);
    startAt += data.issues.length;

    if (startAt >= data.total) break;
  }

  return issues;
}

/**
 * Extract story points from an issue.
 */
function getStoryPoints(issue) {
  const val = issue.fields[STORY_POINTS_FIELD];
  return typeof val === 'number' ? val : 0;
}

/**
 * Compute cycle time in days from created to resolutiondate.
 */
function computeCycleTimeDays(issue) {
  const created = issue.fields.created;
  const resolved = issue.fields.resolutiondate;
  if (!created || !resolved) return null;
  const ms = new Date(resolved).getTime() - new Date(created).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * Map a raw Jira issue to a compact representation.
 */
function mapIssue(issue) {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    issueType: issue.fields.issuetype?.name,
    status: issue.fields.status?.name,
    storyPoints: getStoryPoints(issue),
    created: issue.fields.created,
    resolutionDate: issue.fields.resolutiondate,
    components: (issue.fields.components || []).map(c => c.name)
  };
}

/**
 * Fetch individual person metrics from Jira.
 *
 * @param {Function} jiraRequest - The authenticated Jira HTTP request function
 * @param {string} jiraDisplayName - Exact Jira display name
 * @param {object} [options]
 * @param {number} [options.lookbackDays=90] - How far back to look for resolved issues
 * @returns {Promise<object>} Person metrics object
 */
async function fetchPersonMetrics(jiraRequest, jiraDisplayName, options = {}) {
  const lookbackDays = options.lookbackDays || 90;

  // Escape the name for JQL (double-quote wrapping handles apostrophes)
  const escapedName = jiraDisplayName.replace(/"/g, '\\"');

  const resolvedJql = `project = RHOAIENG AND assignee = "${escapedName}" AND resolved >= -${lookbackDays}d AND issuetype in (Story, Bug, Task, Vulnerability, Weakness)`;
  const inProgressJql = `project = RHOAIENG AND assignee = "${escapedName}" AND status in ("In Progress", "Code Review") AND issuetype in (Story, Bug, Task, Vulnerability, Weakness)`;

  const [resolvedIssues, inProgressIssues] = await Promise.all([
    fetchAllJqlResults(jiraRequest, resolvedJql, FIELDS),
    fetchAllJqlResults(jiraRequest, inProgressJql, FIELDS)
  ]);

  // Compute resolved metrics
  const resolvedMapped = resolvedIssues.map(mapIssue);
  const resolvedPoints = resolvedIssues.reduce((sum, i) => sum + getStoryPoints(i), 0);

  // Compute in-progress metrics
  const inProgressMapped = inProgressIssues.map(mapIssue);
  const inProgressPoints = inProgressIssues.reduce((sum, i) => sum + getStoryPoints(i), 0);

  // Compute cycle time for resolved issues
  const cycleTimes = resolvedIssues
    .map(computeCycleTimeDays)
    .filter(d => d !== null && d >= 0);

  let avgDays = null;
  let medianDays = null;

  if (cycleTimes.length > 0) {
    avgDays = +(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length).toFixed(1);
    const sorted = [...cycleTimes].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianDays = sorted.length % 2 === 0
      ? +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1)
      : +sorted[mid].toFixed(1);
  }

  return {
    jiraDisplayName,
    fetchedAt: new Date().toISOString(),
    lookbackDays,
    resolved: {
      count: resolvedMapped.length,
      storyPoints: resolvedPoints,
      issues: resolvedMapped
    },
    inProgress: {
      count: inProgressMapped.length,
      storyPoints: inProgressPoints,
      issues: inProgressMapped
    },
    cycleTime: {
      avgDays,
      medianDays
    }
  };
}

module.exports = { fetchPersonMetrics };
