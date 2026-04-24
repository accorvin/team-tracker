/**
 * Fetch GitHub PR data via the Repository GraphQL API.
 *
 * Both initial and incremental fetches use `repository.pullRequests`
 * ordered by UPDATED_AT DESC with an early-stop on updatedAt. The only
 * difference is the cutoff date (lookback vs lastFetchedAt).
 *
 * Initial fetch adds an open-PR backfill pass to capture stale open PRs
 * whose updatedAt predates the lookback window.
 *
 * Uses GITHUB_TOKEN env var for authentication (same PAT as team-tracker).
 */

const fetch = require('node-fetch');

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const REPO_DELAY_MS = 2000;

function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }
  return token;
}

async function graphqlRequest(query, variables) {
  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${getToken()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'org-pulse-pr-analytics'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.errors && !json.data) {
    throw new Error(`GraphQL error: ${json.errors.map(e => e.message).join('; ')}`);
  }
  return json;
}

function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// ─── Size bucket derivation ───

function sizeBucket(additions, deletions) {
  const total = (additions || 0) + (deletions || 0);
  if (total < 50) return 'XS';
  if (total < 200) return 'S';
  if (total < 1000) return 'M';
  if (total < 2500) return 'L';
  return 'XL';
}

// ─── Repo validation ───

const REPO_EXISTS_QUERY = `
query RepoExists($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) { nameWithOwner }
}`;

async function verifyRepoExists(owner, repo) {
  const result = await graphqlRequest(REPO_EXISTS_QUERY, { owner, repo });
  if (!result.data?.repository) {
    throw new Error(`Repository ${owner}/${repo} not found or not accessible`);
  }
}

// ─── GraphQL queries ───

const PR_FIELDS = `
  number
  title
  url
  author { login }
  createdAt
  mergedAt
  closedAt
  updatedAt
  additions
  deletions
  reviewThreads(first: 50) {
    nodes {
      isResolved
      comments(first: 1) {
        nodes { author { login } }
      }
    }
  }`;

const OPEN_PRS_QUERY = `
query OpenPRs($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequests(
      first: 50
      after: $cursor
      states: [OPEN]
      orderBy: {field: UPDATED_AT, direction: DESC}
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ${PR_FIELDS}
      }
    }
  }
}`;

const INCREMENTAL_PRS_QUERY = `
query IncrementalPRs($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequests(
      first: 50
      after: $cursor
      orderBy: {field: UPDATED_AT, direction: DESC}
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ${PR_FIELDS}
      }
    }
  }
}`;

// ─── Bot matching ───

function makeBotSet(botUsernames) {
  const set = new Set();
  for (const b of (botUsernames || [])) {
    const lower = b.toLowerCase();
    const bare = lower.replace(/\[bot\]$/, '');
    set.add(bare);
    set.add(bare + '[bot]');
  }
  return set;
}

function isBot(login, botSet) {
  return login && botSet.has(login.toLowerCase());
}

// ─── PR node → cache record ───

function transformPR(node, repoSlug, config) {
  const author = node.author?.login || 'ghost';
  const botSet = makeBotSet(config.prBotUsernames);
  const authorIsBot = isBot(author, botSet);

  const threads = node.reviewThreads?.nodes || [];
  const totalReviewThreads = threads.length;
  const aiThreads = { resolved: 0, total: 0 };
  for (const t of threads) {
    const firstCommentAuthor = t.comments?.nodes?.[0]?.author?.login;
    if (isBot(firstCommentAuthor, botSet)) {
      aiThreads.total++;
      if (t.isResolved) aiThreads.resolved++;
    }
  }

  const isMerged = !!node.mergedAt;
  const isClosed = !isMerged && !!node.closedAt;
  const createdMs = new Date(node.createdAt).getTime();
  const cycleTimeHours = isMerged
    ? Math.round(((new Date(node.mergedAt).getTime() - createdMs) / 3600000) * 10) / 10
    : null;

  let state = 'open';
  if (isMerged) state = 'merged';
  else if (isClosed) state = 'closed';

  // Raw thread metadata for local bot reclassification
  const _threads = threads.map(t => ({
    firstCommentAuthor: t.comments?.nodes?.[0]?.author?.login || null,
    isResolved: t.isResolved
  }));

  return {
    repo: repoSlug,
    number: node.number,
    title: node.title,
    url: node.url,
    author,
    authorIsBot,
    state,
    createdAt: node.createdAt,
    mergedAt: node.mergedAt || null,
    closedAt: node.closedAt || null,
    updatedAt: node.updatedAt,
    cycleTimeHours,
    additions: node.additions || 0,
    deletions: node.deletions || 0,
    sizeBucket: sizeBucket(node.additions, node.deletions),
    aiThreads,
    totalReviewThreads,
    _threads
  };
}

// ─── Bot reclassification from stored raw data ───

function reclassifyBotFields(pullRequests, botUsernames) {
  const botSet = makeBotSet(botUsernames);

  return pullRequests.map(function(pr) {
    if (!pr._threads) return pr;

    const authorIsBot = isBot(pr.author, botSet);

    const aiThreads = { resolved: 0, total: 0 };
    for (const t of pr._threads) {
      if (isBot(t.firstCommentAuthor, botSet)) {
        aiThreads.total++;
        if (t.isResolved) aiThreads.resolved++;
      }
    }

    return {
      ...pr,
      authorIsBot,
      aiThreads
    };
  });
}

// ─── Fetching logic ───

async function fetchOpenPRs(owner, repo, config) {
  const repoSlug = `${owner}/${repo}`;
  const prs = [];
  let cursor = null;

  while (true) {
    const result = await graphqlRequest(OPEN_PRS_QUERY, { owner, repo, cursor });
    const connection = result.data?.repository?.pullRequests;
    if (!connection) break;

    for (const node of connection.nodes) {
      prs.push(transformPR(node, repoSlug, config));
    }

    if (!connection.pageInfo.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }

  return prs;
}

async function fetchIncrementalPRs(owner, repo, config, sinceDate) {
  const repoSlug = `${owner}/${repo}`;
  const prs = [];
  let cursor = null;
  let page = 0;

  while (true) {
    page++;
    const result = await graphqlRequest(INCREMENTAL_PRS_QUERY, { owner, repo, cursor });
    const connection = result.data?.repository?.pullRequests;
    if (!connection) break;

    let hitStop = false;
    for (const node of connection.nodes) {
      const updatedAt = node.updatedAt ? new Date(node.updatedAt) : null;
      if (updatedAt && updatedAt < sinceDate) {
        hitStop = true;
        break;
      }
      prs.push(transformPR(node, repoSlug, config));
    }

    if (hitStop || !connection.pageInfo.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;

    console.log(`[pr-fetcher] ${repoSlug} incremental page ${page} (${prs.length} updated PRs so far)`);
  }

  return prs;
}

/**
 * Fetch PR data for a single repo with incremental chunking.
 *
 * @param {string} owner - GitHub org/owner
 * @param {string} repo - GitHub repo name
 * @param {object} config - Module config
 * @param {object|null} existingData - Parsed repo file ({ lastFetchedAt, pullRequests }) or null
 * @param {object} options - { force, onChunkComplete }
 * @returns {{ status, pullRequests, lastFetchedAt, error?, completedChunks? }}
 */
async function fetchRepoPRData(owner, repo, config, existingData, options) {
  const force = options.force || false;
  const onChunkComplete = options.onChunkComplete || null;
  const repoSlug = `${owner}/${repo}`;

  await verifyRepoExists(owner, repo);

  const lastFetchedAt = (!force && existingData?.lastFetchedAt)
    ? new Date(existingData.lastFetchedAt)
    : null;

  const isIncremental = !!lastFetchedAt;
  const rangeEnd = new Date();

  const existingPRs = existingData?.pullRequests || [];
  const prMap = new Map();
  for (const pr of existingPRs) {
    prMap.set(`${pr.repo}#${pr.number}`, pr);
  }

  const cutoffDate = isIncremental
    ? lastFetchedAt
    : new Date(Date.now() - (config.prLookbackDays || 90) * 24 * 60 * 60 * 1000);

  try {
    // 1. All PRs updated since cutoff (merged, closed, and active open)
    const label = isIncremental ? 'incremental' : 'initial';
    console.log(`[pr-fetcher] ${repoSlug} ${label} since ${cutoffDate.toISOString()}`);
    const recentPRs = await fetchIncrementalPRs(owner, repo, config, cutoffDate);
    for (const pr of recentPRs) {
      prMap.set(`${pr.repo}#${pr.number}`, pr);
    }

    if (onChunkComplete) {
      onChunkComplete({
        lastFetchedAt: existingData?.lastFetchedAt || null,
        pullRequests: [...prMap.values()]
      });
    }

    // 2. Open PR backfill (initial only) — catches stale open PRs
    //    whose updatedAt predates the lookback window
    let openBackfillCount = 0;
    if (!isIncremental) {
      const openPRs = await fetchOpenPRs(owner, repo, config);
      for (const pr of openPRs) {
        prMap.set(`${pr.repo}#${pr.number}`, pr);
      }
      openBackfillCount = openPRs.length;
    }

    console.log(`[pr-fetcher] ${repoSlug}: ${recentPRs.length} recent PRs` +
      (openBackfillCount ? ` + ${openBackfillCount} open backfill` : '') +
      ` (${label})`);

    return {
      status: 'complete',
      lastFetchedAt: rangeEnd.toISOString(),
      dataStartDate: existingData?.dataStartDate || cutoffDate.toISOString(),
      pullRequests: [...prMap.values()],
      completedChunks: 0
    };
  } catch (err) {
    console.error(`[pr-fetcher] ${repoSlug} failed:`, err.message);
    return {
      status: 'partial',
      lastFetchedAt: existingData?.lastFetchedAt || null,
      dataStartDate: existingData?.dataStartDate || cutoffDate.toISOString(),
      pullRequests: [...prMap.values()],
      completedChunks: 0,
      error: err.message
    };
  }
}

/**
 * Fetch PR data for all configured repos with per-repo checkpointing.
 *
 * @param {object} config - Module config with prRepos, prBotUsernames, etc.
 * @param {object} storageHelpers - { readRepoData, writeRepoData } for per-repo file I/O
 * @param {function} onRepoStart - Called with (repoSlug, index, total) before each repo
 * @returns {{ repoResults }}
 */
async function fetchAllPRData(config, storageHelpers, onRepoStart) {
  const repos = config.prRepos || [];
  if (repos.length === 0) {
    throw new Error('No repos configured. Add repos in Settings > AI Impact.');
  }

  const repoResults = [];

  for (let i = 0; i < repos.length; i++) {
    const repoSlug = repos[i];
    const [owner, repo] = repoSlug.split('/');
    if (onRepoStart) onRepoStart(repoSlug, i, repos.length);

    console.log(`[pr-fetcher] Fetching ${repoSlug} (${i + 1}/${repos.length})`);

    const existingData = storageHelpers.readRepoData(repoSlug);

    try {
      const result = await fetchRepoPRData(owner, repo, config, existingData, {
        force: false,
        onChunkComplete: function(data) {
          storageHelpers.writeRepoData(repoSlug, data);
        }
      });

      storageHelpers.writeRepoData(repoSlug, {
        lastFetchedAt: result.lastFetchedAt,
        dataStartDate: result.dataStartDate,
        lastError: null,
        pullRequests: result.pullRequests
      });

      repoResults.push({
        repo: repoSlug,
        status: result.status,
        prCount: result.pullRequests.length,
        completedChunks: result.completedChunks,
        error: result.error || null
      });
    } catch (err) {
      console.error(`[pr-fetcher] ${repoSlug} failed:`, err.message);
      storageHelpers.writeRepoData(repoSlug, {
        lastFetchedAt: null,
        lastError: { message: err.message, at: new Date().toISOString() },
        pullRequests: []
      });
      repoResults.push({
        repo: repoSlug,
        status: 'failed',
        error: err.message
      });
    }

    if (i < repos.length - 1) {
      await delay(REPO_DELAY_MS);
    }
  }

  return { repoResults };
}

module.exports = {
  fetchAllPRData,
  fetchRepoPRData,
  reclassifyBotFields,
  sizeBucket
};
