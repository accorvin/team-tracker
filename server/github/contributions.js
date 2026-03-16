/**
 * Fetch GitHub contribution stats via GraphQL API.
 *
 * Uses GITHUB_TOKEN env var for authentication.
 * Batches users into groups to minimize API calls.
 */

const fetch = require('node-fetch');

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;

function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }
  return token;
}

async function graphqlRequest(query) {
  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${getToken()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'team-tracker'
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch yearly contribution counts for a list of GitHub usernames.
 * @param {string[]} usernames - GitHub usernames to query
 * @returns {Object} Map of username -> { totalContributions, fetchedAt } or null if user not found
 */
async function fetchContributions(usernames) {
  const results = {};
  const batches = [];

  for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
    batches.push(usernames.slice(i, i + BATCH_SIZE));
  }

  console.log(`[github] Fetching contributions for ${usernames.length} users in ${batches.length} batch(es)`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const aliases = batch.map(function(username, i) {
      const safeAlias = `u${i}`;
      return `${safeAlias}: user(login: ${JSON.stringify(username)}) { contributionsCollection { contributionCalendar { totalContributions } } }`;
    });

    const query = `query { ${aliases.join(' ')} }`;

    try {
      const response = await graphqlRequest(query);
      const now = new Date().toISOString();

      for (let i = 0; i < batch.length; i++) {
        const alias = `u${i}`;
        const userData = response.data?.[alias];
        if (userData) {
          results[batch[i]] = {
            totalContributions: userData.contributionsCollection.contributionCalendar.totalContributions,
            fetchedAt: now
          };
        } else {
          results[batch[i]] = null;
        }
      }

      if (response.errors) {
        for (const err of response.errors) {
          const match = err.path?.[0]?.match(/^u(\d+)$/);
          if (match) {
            const idx = parseInt(match[1]);
            if (idx < batch.length) {
              console.log(`[github] User not found or error: ${batch[idx]} - ${err.message}`);
              results[batch[idx]] = null;
            }
          }
        }
      }

      console.log(`[github] Batch ${batchIdx + 1}/${batches.length} complete (${batch.length} users)`);
    } catch (err) {
      console.error(`[github] Batch ${batchIdx + 1} failed:`, err.message);
      for (const username of batch) {
        if (!(username in results)) {
          results[username] = null;
        }
      }
    }

    if (batchIdx < batches.length - 1) {
      await delay(BATCH_DELAY_MS);
    }
  }

  return results;
}

/**
 * Fetch weekly contribution breakdown for a list of GitHub usernames.
 * Returns daily counts that can be bucketed into months.
 * @param {string[]} usernames - GitHub usernames to query
 * @returns {Object} Map of username -> { months: { "YYYY-MM": count }, fetchedAt } or null
 */
async function fetchContributionHistory(usernames) {
  const results = {};
  const HISTORY_BATCH = 5;
  const batches = [];

  for (let i = 0; i < usernames.length; i += HISTORY_BATCH) {
    batches.push(usernames.slice(i, i + HISTORY_BATCH));
  }

  console.log(`[github] Fetching contribution history for ${usernames.length} users in ${batches.length} batch(es)`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const aliases = batch.map(function(username, i) {
      const safeAlias = `u${i}`;
      return `${safeAlias}: user(login: ${JSON.stringify(username)}) { contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } } }`;
    });

    const query = `query { ${aliases.join(' ')} }`;

    try {
      const response = await graphqlRequest(query);
      const now = new Date().toISOString();

      for (let i = 0; i < batch.length; i++) {
        const alias = `u${i}`;
        const userData = response.data?.[alias];
        if (userData) {
          const months = {};
          const weeks = userData.contributionsCollection.contributionCalendar.weeks || [];
          for (const week of weeks) {
            for (const day of week.contributionDays || []) {
              const monthKey = day.date.slice(0, 7);
              months[monthKey] = (months[monthKey] || 0) + day.contributionCount;
            }
          }
          results[batch[i]] = { months, fetchedAt: now };
        } else {
          results[batch[i]] = null;
        }
      }

      if (response.errors) {
        for (const err of response.errors) {
          const match = err.path?.[0]?.match(/^u(\d+)$/);
          if (match) {
            const idx = parseInt(match[1]);
            if (idx < batch.length) {
              console.log(`[github] History - User error: ${batch[idx]} - ${err.message}`);
              results[batch[idx]] = null;
            }
          }
        }
      }

      console.log(`[github] History batch ${batchIdx + 1}/${batches.length} complete (${batch.length} users)`);
    } catch (err) {
      console.error(`[github] History batch ${batchIdx + 1} failed:`, err.message);
      for (const username of batch) {
        if (!(username in results)) {
          results[username] = null;
        }
      }
    }

    if (batchIdx < batches.length - 1) {
      await delay(BATCH_DELAY_MS);
    }
  }

  return results;
}

module.exports = { fetchContributions, fetchContributionHistory };
