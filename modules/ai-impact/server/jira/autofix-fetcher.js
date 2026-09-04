const { fetchAllJqlResults } = require('../../../../shared/server/jira');
const { validateJqlSafeString } = require('../config');

const TERMINAL_LABELS = [
  'jira-autofix-merged',
  'jira-autofix-rejected',
  'jira-autofix-max-retries',
  'jira-autofix-stale'
];

const TERMINAL_STATES = new Set([
  'autofix-merged', 'autofix-rejected', 'autofix-max-retries', 'autofix-stale'
]);

// Gross cohort excludes only immutable issue content markers. Mutable labels
// and status changes remain in the cohort so closed-before-pickup is visible.
const GROSS_POLICY_EXCLUSION_LABELS = ['CVE'];
const CURRENT_POLICY_EXCLUSION_LABELS = ['no-autofix', 'auto-created', 'CVE'];
const POLICY_PROPOSAL_STATES = new Set([
  'autofix-review',
  'autofix-ci-failing',
  'autofix-merged',
  'autofix-rejected',
  'autofix-max-retries',
  'autofix-stale'
]);
const POLICY_ABANDONMENT_STATES = new Set([
  'autofix-rejected',
  'autofix-max-retries',
  'autofix-stale'
]);
const POLICY_BLOCKED_STATES = new Set(['autofix-blocked']);
const OUTCOME_EVENT_TYPE = 'jira_autofix.lifecycle.outcome';
const AUTOFIX_BOT_SENTINEL = 'jira-autofix bot';

// All labels from the jira-autofix triage + autofix pipelines
const TRIAGE_LABELS = [
  'jira-triage-pending',
  'jira-triage-missing-info',
  'jira-triage-not-fixable',
  'jira-triage-stale',
  'jira-triage-external',
  'jira-triage-security-review'
];

const AUTOFIX_LABELS = [
  'jira-autofix',
  'jira-autofix-pending',
  'jira-autofix-review',
  'jira-autofix-ci-failing',
  'jira-autofix-merged',
  'jira-autofix-rejected',
  'jira-autofix-max-retries',
  'jira-autofix-blocked',
  'jira-autofix-stale'
];

const ALL_PIPELINE_LABELS = [...TRIAGE_LABELS, ...AUTOFIX_LABELS];

function classifyIssue(labels) {
  const labelSet = new Set(labels);

  // Terminal autofix states (check first — most specific)
  if (labelSet.has('jira-autofix-merged')) return 'autofix-merged';
  if (labelSet.has('jira-autofix-rejected')) return 'autofix-rejected';
  if (labelSet.has('jira-autofix-max-retries')) return 'autofix-max-retries';
  if (labelSet.has('jira-autofix-stale')) return 'autofix-stale';
  // Active autofix states (blocked before pending — blocked is added when
  // the bot gets stuck after starting, but pending may not be removed)
  if (labelSet.has('jira-autofix-blocked')) return 'autofix-blocked';
  if (labelSet.has('jira-autofix-ci-failing')) return 'autofix-ci-failing';
  if (labelSet.has('jira-autofix-review')) return 'autofix-review';
  if (labelSet.has('jira-autofix-pending')) return 'autofix-pending';
  if (labelSet.has('jira-autofix')) return 'autofix-ready';
  // Triage states (security-review first: it's added alongside other verdicts
  // and should take precedence since it requires human review)
  if (labelSet.has('jira-triage-security-review')) return 'triage-security-review';
  if (labelSet.has('jira-triage-external')) return 'triage-external';
  if (labelSet.has('jira-triage-not-fixable')) return 'triage-not-fixable';
  if (labelSet.has('jira-triage-stale')) return 'triage-stale';
  if (labelSet.has('jira-triage-missing-info')) return 'triage-missing-info';
  if (labelSet.has('jira-triage-pending')) return 'triage-pending';

  return 'unknown';
}

function processIssue(issue) {
  const labels = issue.fields.labels || [];
  const components = (issue.fields.components || []).map(c => c.name);

  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name || 'Unknown',
    issueType: issue.fields.issuetype?.name || 'Unknown',
    priority: issue.fields.priority?.name || 'None',
    created: issue.fields.created,
    updated: issue.fields.updated,
    terminalAt: null,
    labels,
    components,
    assignee: issue.fields.assignee?.displayName || null,
    securityLevel: issue.fields.security?.name || null,
    pipelineState: classifyIssue(labels),
    mrLinks: extractForgeLinks(issue.fields.comment)
  };
}

function extractForgeLinks(commentField) {
  const comments = commentField?.comments || (Array.isArray(commentField) ? commentField : []);
  const text = comments
    .map(comment => collectJiraText(comment.body || comment))
    .filter(commentText => new RegExp(`(^|\\n)\\s*(?:#{1,6}\\s*)?${AUTOFIX_BOT_SENTINEL}`, 'i').test(commentText))
    .join(' ');
  const matches = text.match(/https?:\/\/[^\s"'<>]+/g) || [];
  const links = new Set();
  for (const match of matches) {
    const link = match.replace(/[),.;]+$/, '');
    if (/github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(link) ||
        /\/merge_requests\/\d+/.test(link)) {
      links.add(link);
    }
  }
  return [...links];
}

function collectJiraText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(collectJiraText).join(' ');
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value).map(([key, item]) => {
    if (key === 'attrs' && item && typeof item === 'object' && item.href) return item.href;
    return collectJiraText(item);
  }).join(' ');
}

function extractPipelineHistory(changelog, pipelineState) {
  const result = {
    terminalAt: null,
    ciFailureCount: 0,
    reviewRoundCount: 0,
    wasBlocked: false
  };

  if (!changelog || !changelog.histories) return result;

  const targetLabel = 'jira-' + pipelineState;
  let latestTerminal = null;

  for (const history of changelog.histories) {
    for (const item of history.items) {
      if (item.field !== 'labels') continue;
      const after = item.toString || '';

      if (after.includes(targetLabel)) {
        const ts = new Date(history.created).getTime();
        if (latestTerminal === null || ts > latestTerminal) latestTerminal = ts;
      }
      if (after.includes('jira-autofix-ci-failing')) {
        result.ciFailureCount++;
      }
      if (after.includes('jira-autofix-review')) {
        result.reviewRoundCount++;
      }
      if (after.includes('jira-autofix-blocked')) {
        result.wasBlocked = true;
      }
    }
  }

  result.terminalAt = latestTerminal ? new Date(latestTerminal).toISOString() : null;
  return result;
}

function extractTerminalAt(changelog, pipelineState) {
  return extractPipelineHistory(changelog, pipelineState).terminalAt;
}

function computeEffortScore(issue) {
  if (issue.pipelineState !== 'autofix-merged') {
    return { effortScore: null, effortTier: null };
  }

  let score = 1;

  if ((issue.ciFailureCount || 0) > 0) score += 1;

  const reviewRounds = issue.reviewRoundCount || 0;
  if (reviewRounds > 1) score += (reviewRounds - 1);

  if (issue.wasBlocked) score += 2;

  if (issue.terminalAt && issue.created) {
    const days = (new Date(issue.terminalAt).getTime() - new Date(issue.created).getTime()) / (24 * 60 * 60 * 1000);
    if (days > 7) score += 1;
  }

  const priority = issue.priority || '';
  if (priority === 'Blocker' || priority === 'Critical') score += 2;

  let tier;
  if (score <= 2) tier = 'Quick Win';
  else if (score <= 4) tier = 'Standard Fix';
  else tier = 'Complex Fix';

  return { effortScore: score, effortTier: tier };
}

function computePriorityBreakdown(issues) {
  const breakdown = {};
  for (let i = 0; i < issues.length; i++) {
    const p = issues[i].priority || 'Undefined';
    breakdown[p] = (breakdown[p] || 0) + 1;
  }
  return breakdown;
}

function computeMedianTimeToFix(issues) {
  const days = [];
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    if (issue.pipelineState !== 'autofix-merged') continue;
    if (!issue.terminalAt || !issue.created) continue;
    const d = (new Date(issue.terminalAt).getTime() - new Date(issue.created).getTime()) / (24 * 60 * 60 * 1000);
    days.push(d);
  }
  if (days.length === 0) return null;
  days.sort(function(a, b) { return a - b; });
  const mid = Math.floor(days.length / 2);
  if (days.length % 2 === 0) {
    return Math.round(((days[mid - 1] + days[mid]) / 2) * 10) / 10;
  }
  return Math.round(days[mid] * 10) / 10;
}

function getLastWeekBounds() {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday
  ));
  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start: lastMonday.getTime(), end: thisMonday.getTime() };
}

function getWindowBounds(timeWindow) {
  const now = new Date();
  switch (timeWindow) {
    case 'week': {
      const day = now.getUTCDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
      return { start: thisMonday.getTime(), end: Date.now(), useTerminalDate: false };
    }
    case 'lastWeek': {
      const bounds = getLastWeekBounds();
      return { start: bounds.start, end: bounds.end, useTerminalDate: true };
    }
    case 'last7':
      return { start: Date.now() - 7 * 24 * 60 * 60 * 1000, end: Date.now(), useTerminalDate: false };
    case 'month': {
      const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { start: firstOfMonth.getTime(), end: Date.now(), useTerminalDate: false };
    }
    case 'lastMonth': {
      const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      return { start: firstOfLastMonth.getTime(), end: firstOfThisMonth.getTime(), useTerminalDate: true };
    }
    case 'last30':
      return { start: Date.now() - 30 * 24 * 60 * 60 * 1000, end: Date.now(), useTerminalDate: false };
    case 'last90':
      return { start: Date.now() - 90 * 24 * 60 * 60 * 1000, end: Date.now(), useTerminalDate: false };
    case 'last180':
      return { start: Date.now() - 180 * 24 * 60 * 60 * 1000, end: Date.now(), useTerminalDate: false };
    case 'all':
      return { start: 0, end: Date.now(), useTerminalDate: false };
    default:
      return { start: Date.now() - 30 * 24 * 60 * 60 * 1000, end: Date.now(), useTerminalDate: false };
  }
}

function issueInWindow(issue, windowStart, windowEnd, useTerminalDate) {
  if (useTerminalDate && TERMINAL_STATES.has(issue.pipelineState) && issue.terminalAt) {
    const t = new Date(issue.terminalAt).getTime();
    return t >= windowStart && t < windowEnd;
  }
  const c = new Date(issue.created).getTime();
  return c >= windowStart && c < windowEnd;
}

function issueCreatedInWindow(issue, windowStart, windowEnd) {
  const created = new Date(issue.created).getTime();
  return created >= windowStart && created < windowEnd;
}

function getPolicyExclusionReasons(issue) {
  const labels = new Set(issue.labels || []);
  const reasons = [];

  if (issue.issueType && issue.issueType !== 'Bug') reasons.push('not_bug');
  if (labels.has('CVE')) reasons.push('cve_label');
  if (/CVE-/i.test(issue.summary || '')) reasons.push('cve_summary');
  if (/EMBARGOED/i.test(issue.summary || '') ||
      issue.securityLevel === 'Embargoed Security Issue') {
    reasons.push('embargoed');
  }

  return reasons;
}

function isPolicyEligibleIssue(issue) {
  return getPolicyExclusionReasons(issue).length === 0;
}

function isCurrentPolicyEligibleIssue(issue) {
  if (!isPolicyEligibleIssue(issue)) return false;
  const labels = new Set(issue.labels || []);
  return !CURRENT_POLICY_EXCLUSION_LABELS.some(label => labels.has(label));
}

function buildProjectClause(projects) {
  return projects.map(project => `"${project}"`).join(', ');
}

function buildCreatedAfterClause(createdAfter) {
  return createdAfter ? ` AND created >= "${createdAfter}"` : '';
}

function buildPipelineJql(config) {
  const projectClause = buildProjectClause(config.autofixProjects);
  const labelClause = ALL_PIPELINE_LABELS.map(label => `"${label}"`).join(', ');
  return `project IN (${projectClause}) AND labels IN (${labelClause})` +
    buildCreatedAfterClause(config.autofixCreatedAfter) + ' ORDER BY created DESC';
}

function buildPolicyEligibleJql(config) {
  const projectClause = buildProjectClause(config.autofixProjects);
  const excludedLabels = GROSS_POLICY_EXCLUSION_LABELS.map(label => `"${label}"`).join(', ');
  const clauses = [
    `project IN (${projectClause})`,
    'type = Bug',
    `(labels IS EMPTY OR labels NOT IN (${excludedLabels}))`,
    'summary !~ "EMBARGOED"',
    '(level IS EMPTY OR level != "Embargoed Security Issue")',
    'summary !~ "CVE-"'
  ];
  if (Array.isArray(config.autofixComponents) && config.autofixComponents.length > 0) {
    const components = config.autofixComponents.map(component => `"${component}"`).join(', ');
    clauses.push(`component IN (${components})`);
  }
  return clauses.join(' AND ') + buildCreatedAfterClause(config.autofixCreatedAfter) + ' ORDER BY created DESC';
}

function buildForgeEvidence(issue) {
  const links = issue.mrLinks || [];
  const statuses = links.length > 0 ? Object.values(issue.mrStatuses || {}) : [];
  const proposalVerified = statuses.some(status => ['opened', 'merged', 'closed'].includes(status));
  const mergeVerified = statuses.includes('merged');
  return {
    available: links.length > 0,
    proposalVerified,
    mergeVerified,
    statusCount: statuses.length,
    source: statuses.length > 0 ? 'forge-api' : links.length > 0 ? 'forge-link-unverified' : 'none'
  };
}

const VALID_OUTCOME_STAGES = new Set([
  'policy_eligibility',
  'analysis',
  'proposal',
  'iteration',
  'blocked',
  'rejected',
  'abandoned',
  'stale',
  'merged',
  'reconciliation',
  'failed'
]);

function normalizeOutcomeEvent(event) {
  if (!event || typeof event !== 'object') return null;
  if (event.event_type !== OUTCOME_EVENT_TYPE ||
      typeof event.event_id !== 'string' ||
      !/^outcome-v1-[0-9a-f]{64}$/.test(event.event_id)) return null;
  if (typeof event.schema_version !== 'string' || !/^1\.[0-9]+$/.test(event.schema_version)) return null;
  if (typeof event.correlation_id !== 'string' || !event.correlation_id ||
      typeof event.final_outcome !== 'string' ||
      !Number.isInteger(event.attempt) || event.attempt < 1 ||
      !event.metrics || typeof event.metrics !== 'object' ||
      !event.metadata || typeof event.metadata !== 'object') return null;
  if (event.metadata?.synthetic === true || event.metadata?.excluded === true) return null;

  const key = event.correlation?.jira_key;
  const stage = event.stage;
  if (!key || typeof key !== 'string' || !VALID_OUTCOME_STAGES.has(stage)) return null;
  const cohortTimestamp = event.cohort_timestamp;
  const transitionTimestamp = event.transition_timestamp;
  if (!cohortTimestamp || Number.isNaN(new Date(cohortTimestamp).getTime()) ||
      !transitionTimestamp || Number.isNaN(new Date(transitionTimestamp).getTime())) return null;
  if (new Date(transitionTimestamp).getTime() < new Date(cohortTimestamp).getTime()) return null;
  return { ...event, stage, jiraKey: key, cohortTimestamp };
}

function conversion(numerator, denominator) {
  return {
    numerator,
    denominator,
    rate: denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null
  };
}

function computePolicyEligibleCohort(
  policyEligibleIssues,
  timeWindow,
  scope = null,
  currentPolicyEligibleIssues = null
) {
  if (!Array.isArray(policyEligibleIssues)) {
    return {
      available: false,
      denominator: null,
      candidateCount: null,
      currentSnapshot: null,
      exclusions: GROSS_POLICY_EXCLUSION_LABELS.concat(['cve_summary', 'embargoed'])
    };
  }

  const { start: windowStart, end: windowEnd } = getWindowBounds(timeWindow);
  const candidates = policyEligibleIssues.filter(issue =>
    issueCreatedInWindow(issue, windowStart, windowEnd)
  );
  const eligible = candidates.filter(isPolicyEligibleIssue);
  const currentEligible = Array.isArray(currentPolicyEligibleIssues)
    ? currentPolicyEligibleIssues.filter(issue => issueCreatedInWindow(issue, windowStart, windowEnd))
    : candidates.filter(isCurrentPolicyEligibleIssue);
  const observedMutableExclusionCounts = {};
  for (const issue of candidates) {
    const labels = new Set(issue.labels || []);
    if (labels.has('no-autofix')) {
      observedMutableExclusionCounts.no_autofix = (observedMutableExclusionCounts.no_autofix || 0) + 1;
    }
    if (labels.has('auto-created')) {
      observedMutableExclusionCounts.auto_created = (observedMutableExclusionCounts.auto_created || 0) + 1;
    }
  }

  return {
    available: true,
    denominator: eligible.length,
    currentSnapshot: currentEligible.length,
    candidateCount: candidates.length,
    total: policyEligibleIssues.length,
    exclusionCounts: null,
    exclusionCountsAvailable: false,
    exclusionCountsNote: 'CVE and embargo exclusions are applied in Jira JQL and are not counted by this snapshot.',
    observedMutableExclusionCounts,
    exclusions: GROSS_POLICY_EXCLUSION_LABELS.concat(['cve_summary', 'embargoed']),
    currentSnapshotExclusions: CURRENT_POLICY_EXCLUSION_LABELS,
    source: 'jira-policy-query',
    scope: scope || 'project-wide fallback; component scope not configured',
    authoritative: false
  };
}

function computeStageFunnel(issues, policyEligibleIssues, outcomeEvents, timeWindow, options = {}) {
  const { start: windowStart, end: windowEnd } = getWindowBounds(timeWindow);
  const rawEvents = Array.isArray(outcomeEvents) ? outcomeEvents : [];
  const parsedEvents = rawEvents.map(normalizeOutcomeEvent).filter(Boolean);
  const validEvents = parsedEvents.filter(event =>
    new Date(event.cohortTimestamp).getTime() >= windowStart &&
    new Date(event.cohortTimestamp).getTime() < windowEnd
  );
  const deduplicatedEvents = [...new Map(validEvents.map(event => [event.event_id, event])).values()];

  function eventKeys(stage, predicate = () => true) {
    return new Set(deduplicatedEvents
      .filter(event => event.stage === stage && predicate(event))
      .map(event => event.jiraKey));
  }

  function intersect(left, right) {
    return new Set([...left].filter(key => right.has(key)));
  }

  if (deduplicatedEvents.length > 0 && options.outcomeEventsComplete === true) {
    const eligible = eventKeys('policy_eligibility', event => event.final_outcome === 'eligible');
    const analyzed = intersect(eligible, eventKeys('analysis'));
    const proposed = intersect(analyzed, eventKeys('proposal'));
    const merged = intersect(proposed, eventKeys('merged'));
    const abandonment = new Set(
      deduplicatedEvents
        .filter(event => ['abandoned', 'stale', 'rejected'].includes(event.stage))
        .map(event => event.jiraKey)
        .filter(key => eligible.has(key))
    );
    const blocked = intersect(eligible, eventKeys('blocked'));
    return {
      source: 'autofix-outcome-events',
      authoritative: true,
      contract: 'AIPCC-31384 lifecycle outcome contract',
      stages: {
        eligible: eligible.size,
        analyzed: analyzed.size,
        prProposed: proposed.size,
        prMerged: merged.size
      },
      abandonment: {
        total: abandonment.size,
        stale: eventKeys('stale').size,
        rejected: eventKeys('rejected').size,
        abandoned: eventKeys('abandoned').size
      },
      blocked: blocked.size,
      conversions: {
        eligibleToAnalyzed: conversion(analyzed.size, eligible.size),
        analyzedToPrProposed: conversion(proposed.size, analyzed.size),
        prProposedToPrMerged: conversion(merged.size, proposed.size),
        eligibleToPrMerged: conversion(merged.size, eligible.size)
      },
      eventStats: {
        valid: deduplicatedEvents.length,
        duplicate: validEvents.length - deduplicatedEvents.length,
        invalid: rawEvents.length - parsedEvents.length,
        outsideWindow: parsedEvents.length - validEvents.length
      },
      limitations: []
    };
  }

  const policyWindow = Array.isArray(policyEligibleIssues)
    ? policyEligibleIssues
      .filter(issue => issueCreatedInWindow(issue, windowStart, windowEnd))
      .map((issue, index) => ({ ...issue, key: issue.key || `__policy-${index}` }))
    : [];
  const policyKeys = new Set(policyWindow.filter(isPolicyEligibleIssue).map(issue => issue.key));
  const pipelineWindow = issues
    .filter(issue => issueCreatedInWindow(issue, windowStart, windowEnd))
    .map((issue, index) => ({ ...issue, key: issue.key || `__pipeline-${index}` }));
  const cohortKeys = policyKeys.size > 0 ? policyKeys : new Set(pipelineWindow.map(issue => issue.key));
  const pipelineByKey = new Map(pipelineWindow.map(issue => [issue.key, issue]));
  const analyzedKeys = new Set(pipelineWindow.filter(issue => cohortKeys.has(issue.key)).map(issue => issue.key));
  const proposedKeys = new Set();
  const mergedKeys = new Set();
  const abandonmentKeys = new Set();
  const blockedKeys = new Set();
  const abandonment = { stale: 0, rejected: 0, maxRetries: 0 };

  for (const key of cohortKeys) {
    const issue = pipelineByKey.get(key);
    if (!issue) continue;
    const forge = buildForgeEvidence(issue);
    if (POLICY_PROPOSAL_STATES.has(issue.pipelineState) || forge.proposalVerified) proposedKeys.add(key);
    if (issue.pipelineState === 'autofix-merged' || forge.mergeVerified) mergedKeys.add(key);
    if (POLICY_ABANDONMENT_STATES.has(issue.pipelineState)) {
      abandonmentKeys.add(key);
      if (issue.pipelineState === 'autofix-stale') abandonment.stale++;
      if (issue.pipelineState === 'autofix-rejected') abandonment.rejected++;
      if (issue.pipelineState === 'autofix-max-retries') abandonment.maxRetries++;
    }
    if (POLICY_BLOCKED_STATES.has(issue.pipelineState)) blockedKeys.add(key);
  }

  return {
    source: 'jira-labels-and-forge-status-proxy',
    authoritative: false,
    contract: 'AIPCC-31384 lifecycle outcome contract (pending producer dependency)',
    stages: {
      eligible: cohortKeys.size,
      analyzed: analyzedKeys.size,
      prProposed: proposedKeys.size,
      prMerged: mergedKeys.size
    },
    abandonment: { total: abandonmentKeys.size, ...abandonment },
    blocked: blockedKeys.size,
    conversions: {
      eligibleToAnalyzed: conversion(analyzedKeys.size, cohortKeys.size),
      analyzedToPrProposed: conversion(proposedKeys.size, analyzedKeys.size),
      prProposedToPrMerged: conversion(mergedKeys.size, proposedKeys.size),
      eligibleToPrMerged: conversion(mergedKeys.size, cohortKeys.size)
    },
    eventStats: {
      valid: validEvents.length,
      duplicate: validEvents.length - deduplicatedEvents.length,
      invalid: rawEvents.length - parsedEvents.length,
      outsideWindow: parsedEvents.length - validEvents.length
    },
    limitations: [
      'Jira labels are mutable and do not prove historical stage transitions.',
      'Forge verification requires a URL in a Jira Autofix bot comment and API credentials.',
      'Use immutable Autofix lifecycle events for authoritative cohort conversion reporting.'
    ]
  };
}

function computeAutofixMetrics(issues, timeWindow, options = {}) {
  const { start: windowStart, end: windowEnd, useTerminalDate } = getWindowBounds(timeWindow);

  const counts = {};
  let windowTotal = 0;

  for (const issue of issues) {
    if (!issueInWindow(issue, windowStart, windowEnd, useTerminalDate)) continue;
    windowTotal++;
    counts[issue.pipelineState] = (counts[issue.pipelineState] || 0) + 1;
  }

  function get(state) { return counts[state] || 0; }

  const autofixStates = {
    ready: get('autofix-ready'),
    pending: get('autofix-pending'),
    review: get('autofix-review'),
    ciFailing: get('autofix-ci-failing'),
    merged: get('autofix-merged'),
    rejected: get('autofix-rejected'),
    maxRetries: get('autofix-max-retries'),
    stale: get('autofix-stale'),
    blocked: get('autofix-blocked')
  };

  const autofixTotal = Object.values(autofixStates).reduce(function(s, v) { return s + v; }, 0);

  const triageVerdicts = {
    ready: autofixTotal,
    missingInfo: get('triage-missing-info'),
    notFixable: get('triage-not-fixable'),
    stale: get('triage-stale'),
    pending: get('triage-pending'),
    external: get('triage-external'),
    securityReview: get('triage-security-review')
  };

  const triageTotal = autofixTotal + triageVerdicts.missingInfo +
    triageVerdicts.notFixable + triageVerdicts.stale + triageVerdicts.pending +
    triageVerdicts.external + triageVerdicts.securityReview;

  const terminalTotal = autofixStates.merged + autofixStates.rejected +
    autofixStates.maxRetries + autofixStates.stale;
  const successRate = terminalTotal > 0
    ? Math.round((autofixStates.merged / terminalTotal) * 100)
    : 0;

  const priorityBreakdown = computePriorityBreakdown(
    issues.filter(function(issue) { return issueInWindow(issue, windowStart, windowEnd, useTerminalDate); })
  );

  const mergedWindowIssues = issues.filter(function(issue) {
    return issue.pipelineState === 'autofix-merged' && issueInWindow(issue, windowStart, windowEnd, useTerminalDate);
  });

  const medianTimeToFixDays = computeMedianTimeToFix(mergedWindowIssues);

  const effortBreakdown = { quickWin: 0, standardFix: 0, complexFix: 0 };
  let totalImpactScore = 0;
  for (let j = 0; j < mergedWindowIssues.length; j++) {
    const tier = mergedWindowIssues[j].effortTier;
    if (tier === 'Quick Win') effortBreakdown.quickWin++;
    else if (tier === 'Standard Fix') effortBreakdown.standardFix++;
    else if (tier === 'Complex Fix') effortBreakdown.complexFix++;
    totalImpactScore += (mergedWindowIssues[j].effortScore || 0);
  }

  const policyEligibleCohort = computePolicyEligibleCohort(
    options.policyEligibleIssues,
    timeWindow,
    options.policyScope,
    options.currentPolicyEligibleIssues
  );
  const stageFunnel = computeStageFunnel(
    issues,
    options.policyEligibleIssues,
    options.outcomeEvents,
    timeWindow,
    { outcomeEventsComplete: options.outcomeEventsComplete === true }
  );

  return {
    triageTotal,
    triageVerdicts,
    autofixStates,
    autofixTotal,
    terminalTotal,
    successRate,
    windowTotal,
    totalIssues: issues.length,
    priorityBreakdown,
    medianTimeToFixDays,
    effortBreakdown,
    totalImpactScore,
    pipelineCohort: {
      denominator: windowTotal,
      ready: triageVerdicts.ready,
      source: 'jira-pipeline-label-query',
      authoritative: false
    },
    pipelineReadyShare: conversion(triageVerdicts.ready, windowTotal),
    policyEligibleCohort,
    stageFunnel
  };
}

// Buckets issues by created date but uses current pipelineState. An issue
// created 3 weeks ago that later moved to autofix-merged appears as "merged"
// in the week it was created, not when it was merged. This is a known
// limitation — Jira labels don't carry timestamps for state transitions.
// The 'lastWeek' time window mitigates this for terminal states by using
// terminalAt (from the Jira changelog) instead of created.
function getTrendWeekCount(timeWindow) {
  if (timeWindow === 'week' || timeWindow === 'lastWeek' || timeWindow === 'last7') return 4;
  if (timeWindow === 'month' || timeWindow === 'lastMonth' || timeWindow === 'last30') return 8;
  if (timeWindow === 'last180') return 26;
  if (timeWindow === 'all') return 52;
  return 13;
}

function getTrendAnchor(timeWindow) {
  if (timeWindow === 'lastWeek') return getLastWeekBounds().end;
  if (timeWindow === 'lastMonth') {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
  }
  return Date.now();
}

function buildTrendData(issues, timeWindow) {
  const { useTerminalDate } = getWindowBounds(timeWindow);
  const weekCounts = getTrendWeekCount(timeWindow);
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  const anchor = getTrendAnchor(timeWindow);

  const buckets = [];
  for (let w = weekCounts - 1; w >= 0; w--) {
    const weekEnd = new Date(anchor - w * MS_PER_WEEK);
    buckets.push({
      date: weekEnd.toISOString().slice(0, 10),
      weekStart: weekEnd.getTime() - MS_PER_WEEK,
      weekEnd: weekEnd.getTime(),
      triaged: 0, autofixed: 0, merged: 0, total: 0,
      review: 0, ciFailing: 0, blocked: 0, maxRetries: 0, autofixStale: 0,
      missingInfo: 0, stale: 0, external: 0, securityReview: 0
    });
  }

  const earliest = buckets[0].weekStart;
  const latest = buckets[buckets.length - 1].weekEnd;

  for (const issue of issues) {
    const state = issue.pipelineState;
    const useTerminalAt = useTerminalDate && TERMINAL_STATES.has(state) && issue.terminalAt;
    const ts = useTerminalAt
      ? new Date(issue.terminalAt).getTime()
      : new Date(issue.created).getTime();

    if (ts < earliest || ts >= latest) continue;

    const bucketIdx = Math.floor((ts - earliest) / MS_PER_WEEK);
    if (bucketIdx < 0 || bucketIdx >= buckets.length) continue;
    const bucket = buckets[bucketIdx];

    bucket.total++;

    const isTriage = state.startsWith('triage-');
    const isAutofix = state.startsWith('autofix-');

    if (isTriage || isAutofix) bucket.triaged++;
    if (isAutofix) bucket.autofixed++;

    if (state === 'autofix-merged') bucket.merged++;
    else if (state === 'autofix-review') bucket.review++;
    else if (state === 'autofix-ci-failing') bucket.ciFailing++;
    else if (state === 'autofix-blocked') bucket.blocked++;
    else if (state === 'autofix-max-retries') bucket.maxRetries++;
    else if (state === 'autofix-stale') bucket.autofixStale++;
    else if (state === 'triage-missing-info') bucket.missingInfo++;
    else if (state === 'triage-stale') bucket.stale++;
    else if (state === 'triage-external') bucket.external++;
    else if (state === 'triage-security-review') bucket.securityReview++;
  }

  return buckets.map(function(b) {
    return {
      date: b.date, triaged: b.triaged, autofixed: b.autofixed,
      merged: b.merged, total: b.total, review: b.review,
      ciFailing: b.ciFailing, blocked: b.blocked, maxRetries: b.maxRetries,
      autofixStale: b.autofixStale,
      missingInfo: b.missingInfo, stale: b.stale,
      external: b.external, securityReview: b.securityReview
    };
  });
}

async function fetchAutofixData(jiraRequest, config) {
  const { autofixProjects, autofixComponents, autofixCreatedAfter } = config;

  for (const p of autofixProjects) {
    validateJqlSafeString(p, 'autofixProjects entry');
  }
  if (Array.isArray(autofixComponents)) {
    for (const component of autofixComponents) {
      validateJqlSafeString(component, 'autofixComponents entry');
    }
  }
  if (autofixCreatedAfter) {
    validateJqlSafeString(autofixCreatedAfter, 'autofixCreatedAfter');
  }

  const pipelineJql = buildPipelineJql({ autofixProjects, autofixCreatedAfter });
  const policyEligibleJql = buildPolicyEligibleJql({ autofixProjects, autofixComponents, autofixCreatedAfter });
  const fields = 'summary,status,issuetype,priority,created,updated,labels,components,assignee,security,comment';
  const [rawIssues, rawPolicyEligibleIssues] = await Promise.all([
    fetchAllJqlResults(jiraRequest, pipelineJql, fields),
    fetchAllJqlResults(jiraRequest, policyEligibleJql, fields)
  ]);

  const processed = rawIssues.map(processIssue);
  const policyEligibleIssues = rawPolicyEligibleIssues.map(processIssue);

  const terminalIssues = processed.filter(i => TERMINAL_STATES.has(i.pipelineState));
  const BATCH = 10;
  for (let i = 0; i < terminalIssues.length; i += BATCH) {
    const batch = terminalIssues.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(function(issue) {
      return jiraRequest(
        '/rest/api/3/issue/' + encodeURIComponent(issue.key) + '?expand=changelog&fields=labels'
      ).then(function(detail) {
        const history = extractPipelineHistory(detail.changelog, issue.pipelineState);
        issue.terminalAt = history.terminalAt;
        issue.ciFailureCount = history.ciFailureCount;
        issue.reviewRoundCount = history.reviewRoundCount;
        issue.wasBlocked = history.wasBlocked;
      });
    }));
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[autofix] changelog fetch failed:', r.reason?.message || r.reason);
      }
    }
  }

  for (let i = 0; i < processed.length; i++) {
    const scoring = computeEffortScore(processed[i]);
    processed[i].effortScore = scoring.effortScore;
    processed[i].effortTier = scoring.effortTier;
  }

  const processedByKey = new Map(processed.map(issue => [issue.key, issue]));
  for (const issue of policyEligibleIssues) {
    const pipelineIssue = processedByKey.get(issue.key);
    if (!pipelineIssue) continue;
    issue.pipelineState = pipelineIssue.pipelineState;
    issue.terminalAt = pipelineIssue.terminalAt;
    issue.ciFailureCount = pipelineIssue.ciFailureCount;
    issue.reviewRoundCount = pipelineIssue.reviewRoundCount;
    issue.wasBlocked = pipelineIssue.wasBlocked;
    issue.mrLinks = pipelineIssue.mrLinks;
  }

  return {
    issues: processed,
    policyEligibleIssues,
    currentPolicyEligibleIssues: policyEligibleIssues.filter(isCurrentPolicyEligibleIssue),
    outcomeEvents: [],
    outcomeEventsComplete: false,
    evidence: {
      pipeline: 'Jira labels',
      policyEligible: 'Jira JQL policy query',
      stageContract: 'AIPCC-31384 lifecycle outcome contract dependency',
      policyScope: Array.isArray(autofixComponents) && autofixComponents.length > 0
        ? `configured components: ${autofixComponents.join(', ')}`
        : 'project-wide fallback; component scope not configured'
    },
    queries: { pipeline: pipelineJql, policyEligible: policyEligibleJql }
  };
}

module.exports = {
  fetchAutofixData,
  buildPipelineJql,
  buildPolicyEligibleJql,
  getPolicyExclusionReasons,
  isPolicyEligibleIssue,
  isCurrentPolicyEligibleIssue,
  computePolicyEligibleCohort,
  computeStageFunnel,
  normalizeOutcomeEvent,
  buildForgeEvidence,
  extractForgeLinks,
  processIssue,
  classifyIssue,
  extractTerminalAt,
  extractPipelineHistory,
  computeEffortScore,
  computePriorityBreakdown,
  computeMedianTimeToFix,
  getLastWeekBounds,
  getWindowBounds,
  computeAutofixMetrics,
  buildTrendData,
  ALL_PIPELINE_LABELS,
  TRIAGE_LABELS,
  AUTOFIX_LABELS,
  TERMINAL_LABELS,
  TERMINAL_STATES,
  GROSS_POLICY_EXCLUSION_LABELS,
  CURRENT_POLICY_EXCLUSION_LABELS,
  POLICY_PROPOSAL_STATES
};
