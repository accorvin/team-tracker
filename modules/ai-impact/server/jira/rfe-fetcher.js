const { fetchAllJqlResults } = require('../../../../shared/server/jira');
const { classifyAIInvolvement } = require('./label-parser');

function extractLabelDate(changelog, targetLabel) {
  if (!changelog?.histories) return null;
  let latestDate = null;
  for (const history of changelog.histories) {
    for (const item of history.items) {
      if (item.field !== 'labels') continue;
      const before = (item.fromString || '').split(/\s+/).filter(Boolean);
      const after = (item.toString || '').split(/\s+/).filter(Boolean);
      if (after.includes(targetLabel) && !before.includes(targetLabel)) {
        const historyDate = new Date(history.created);
        if (!latestDate || historyDate > new Date(latestDate)) {
          latestDate = history.created;
        }
      }
    }
  }
  return latestDate;
}

function processIssue(issue, config) {
  const {
    createdLabel,
    revisedLabel,
    testExclusionLabel
  } = config;

  const labels = issue.fields.labels || [];
  const aiInvolvement = classifyAIInvolvement(
    labels, createdLabel, revisedLabel, testExclusionLabel
  );

  // Only extract label dates when the label is currently on the issue.
  let createdLabelDate = null;
  let revisedLabelDate = null;

  if (aiInvolvement === 'created' || aiInvolvement === 'both') {
    createdLabelDate = extractLabelDate(issue.changelog, createdLabel)
      || issue.fields.created;
  }
  if (aiInvolvement === 'revised' || aiInvolvement === 'both') {
    revisedLabelDate = extractLabelDate(issue.changelog, revisedLabel)
      || issue.fields.created;
  }

  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name || 'Unknown',
    priority: issue.fields.priority?.name || 'None',
    created: issue.fields.created,
    creator: issue.fields.creator?.name || issue.fields.creator?.emailAddress || 'unknown',
    creatorDisplayName: issue.fields.creator?.displayName || 'Unknown',
    labels,
    aiInvolvement,
    createdLabelDate,
    revisedLabelDate,
    linkedFeature: null,
    _rawIssueLinks: issue.fields.issuelinks || []
  };
}

async function fetchRFEData(jiraRequest, config) {
  const {
    jiraProject,
    excludedStatuses,
    lookbackMonths,
    testExclusionLabel
  } = config;

  // Validate all config values at JQL construction time (defense in depth).
  const { validateJqlSafeString } = require('../config');
  validateJqlSafeString(jiraProject, 'jiraProject');
  if (testExclusionLabel) validateJqlSafeString(testExclusionLabel, 'testExclusionLabel');
  for (const s of excludedStatuses) validateJqlSafeString(s, 'excludedStatuses entry');

  // Build JQL
  let jql = `project = "${jiraProject}"`;

  // Exclude statuses
  if (excludedStatuses.length > 0) {
    const quoted = excludedStatuses.map(s => `"${s}"`).join(', ');
    jql += ` AND status NOT IN (${quoted})`;
  }

  // Lookback window
  if (lookbackMonths > 0) {
    jql += ` AND created >= -${lookbackMonths * 30}d`;
  }

  // Exclude test issues
  if (testExclusionLabel) {
    jql += ` AND labels != "${testExclusionLabel}"`;
  }

  jql += ' ORDER BY created DESC';

  const fields = 'summary,status,priority,created,creator,labels,issuelinks';

  // Use cursor-based pagination (same as person-metrics.js)
  const issues = await fetchAllJqlResults(jiraRequest, jql, fields, { expand: 'changelog' });

  // Process each issue
  return issues.map(issue => processIssue(issue, config));
}

module.exports = { fetchRFEData, processIssue, extractLabelDate };
