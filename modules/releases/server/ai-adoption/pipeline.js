/**
 * AI Adoption pipeline — fetches features from Jira and scans for
 * AI pipeline labels to produce adoption scorecards per release group.
 *
 * Mount: consumed by ./routes.js
 */

const PROJECTS = ['AIPCC', 'RHAIENG', 'RHOAIENG', 'INFERENG', 'RHAI', 'RHAISTRAT'];

const RELEASE_GROUPS = [
  {
    name: '3.4 GA',
    fixVersions: ['rhoai-3.4', 'rhelai-3.4', 'RHAII-3.4']
  },
  {
    name: '3.5 EA1',
    fixVersions: ['3.5 EA1 RHOAI RELEASE', '3.5 EA1 RHELAI RELEASE', '3.5 EA1 RHAII RELEASE']
  },
  {
    name: '3.5 EA2',
    fixVersions: ['3.5 EA2 RHOAI RELEASE', '3.5 EA2 RHELAI RELEASE', '3.5 EA2 RHAII RELEASE']
  },
  {
    name: '3.5 GA',
    fixVersions: ['3.5 GA RHOAI Release', '3.5 GA RHELAI RELEASE', '3.5 GA RHAII RELEASE']
  }
];

const AI_PIPELINE_TAXONOMY = {
  stratCreator: {
    name: 'Strategy Creator',
    prefixes: [
      'strat-creator-auto-created',
      'strat-creator-auto-refined',
      'strat-creator-rubric-pass',
      'strat-creator-human-sign-off'
    ]
  },
  rfeCreator: {
    name: 'RFE Creator',
    prefixes: [
      'rfe-creator-auto-created',
      'rfe-creator-autofix-rubric-pass',
      'rfe-creator-feasibility-pass',
      'rfe-creator-split-result'
    ]
  },
  testPlan: {
    name: 'Test Plan Generator',
    prefixes: [
      'test-plan-auto-created',
      'test-plan-auto-revised',
      'test-plan-rubric-pass'
    ]
  },
  qg1: {
    name: 'Priority Scoring (QG1)',
    prefixes: ['rp-qg1-auto-rice', 'rp-qg1-pass', 'rp-qg1-fail']
  },
  aiDoc: {
    name: 'AI-First Documentation',
    prefixes: [
      'ai1st-doc-contributed',
      'ai1st-doc-invoked',
      'ai1st-jira-contributed'
    ]
  },
  uxdAgentic: {
    name: 'UXD Agentic',
    prefixes: ['uxd-agentic']
  }
};

const PIPELINE_KEYS = Object.keys(AI_PIPELINE_TAXONOMY);

/**
 * Scan a single issue's labels and return which pipelines are present.
 * @param {string[]} labels
 * @returns {{ touched: boolean, pipelines: Record<string, number> }}
 */
function scanLabels(labels) {
  const pipelines = {};
  let touched = false;

  for (const key of PIPELINE_KEYS) {
    const { prefixes } = AI_PIPELINE_TAXONOMY[key];
    const hit = labels.some(l => prefixes.some(p => l === p || l.startsWith(p + '-')));
    if (hit) {
      pipelines[key] = 1;
      touched = true;
    } else {
      pipelines[key] = 0;
    }
  }

  return { touched, pipelines };
}

/**
 * Fetch AI adoption data for the specified release groups.
 *
 * @param {object} jiraClient - { fetchAllJqlResults }
 * @param {object} [options]
 * @param {string} [options.releaseGroup] - single release group name to filter
 * @param {string} [options.component] - component name filter
 * @returns {Promise<object[]>} array of release group results
 */
async function fetchAiAdoptionData(jiraClient, options = {}) {
  const groups = options.releaseGroup
    ? RELEASE_GROUPS.filter(g => g.name === options.releaseGroup)
    : RELEASE_GROUPS;

  const results = [];

  for (const group of groups) {
    const fvList = group.fixVersions.map(v => `"${v}"`).join(', ');
    const projectList = PROJECTS.join(', ');
    const jql = `project in (${projectList}) AND issuetype = Feature AND fixVersion in (${fvList}) ORDER BY key ASC`;
    const fields = 'summary,status,labels,components,fixVersions';

    let issues;
    try {
      issues = await jiraClient.fetchAllJqlResults(jql, fields, { maxResults: 200 });
    } catch (err) {
      console.warn(`[ai-adoption] Jira fetch failed for ${group.name}: ${err.message}`);
      issues = [];
    }

    const componentMap = {};
    let totalFeatures = 0;
    let aiTouchedFeatures = 0;
    let filteredTotal = 0;
    let filteredAiTouched = 0;

    for (const issue of issues) {
      const f = issue.fields || {};
      const labels = f.labels || [];
      const components = (f.components || []).map(c => c.name);
      const { touched, pipelines } = scanLabels(labels);

      totalFeatures++;
      if (touched) aiTouchedFeatures++;

      if (options.component && !components.includes(options.component)) continue;

      filteredTotal++;
      if (touched) filteredAiTouched++;

      const compNames = options.component
        ? [options.component]
        : (components.length > 0 ? components : ['(No Component)']);
      for (const compName of compNames) {
        if (!componentMap[compName]) {
          componentMap[compName] = { name: compName, total: 0, aiTouched: 0, pipelines: {} };
          for (const key of PIPELINE_KEYS) componentMap[compName].pipelines[key] = 0;
        }
        componentMap[compName].total++;
        if (touched) componentMap[compName].aiTouched++;
        for (const key of PIPELINE_KEYS) {
          componentMap[compName].pipelines[key] += pipelines[key];
        }
      }
    }

    const componentList = Object.values(componentMap).sort((a, b) => b.aiTouched - a.aiTouched);

    results.push({
      releaseGroup: group.name,
      totalFeatures: options.component ? filteredTotal : totalFeatures,
      aiTouchedFeatures: options.component ? filteredAiTouched : aiTouchedFeatures,
      components: componentList
    });
  }

  return results;
}

module.exports = {
  fetchAiAdoptionData,
  scanLabels,
  AI_PIPELINE_TAXONOMY,
  PIPELINE_KEYS,
  RELEASE_GROUPS,
  PROJECTS
};
