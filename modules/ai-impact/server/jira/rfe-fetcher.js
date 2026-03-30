const { fetchAllJqlResults } = require('../../../../shared/server/jira');
const { classifyAIInvolvement } = require('./label-parser');

function processIssue(issue, config) {
  const {
    createdLabelPrefix,
    assessedLabelPrefix,
    testExclusionLabel
  } = config;

  const labels = issue.fields.labels || [];
  const aiInvolvement = classifyAIInvolvement(
    labels, createdLabelPrefix, assessedLabelPrefix, testExclusionLabel
  );

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
  const issues = await fetchAllJqlResults(jiraRequest, jql, fields);

  // Process each issue
  return issues.map(issue => processIssue(issue, config));
}

module.exports = { fetchRFEData, processIssue };
