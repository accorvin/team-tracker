/**
 * Fetch GitHub contribution stats via GraphQL API.
 *
 * Uses `gh api graphql` CLI for authentication.
 * Batches users into groups of 50 to minimize API calls.
 */

const { execSync } = require('child_process');

const BATCH_SIZE = 10;

/**
 * Fetch yearly contribution counts for a list of GitHub usernames.
 * @param {string[]} usernames - GitHub usernames to query
 * @returns {Object} Map of username -> { totalContributions, fetchedAt } or null if user not found
 */
function fetchContributions(usernames) {
  const results = {};
  const batches = [];

  for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
    batches.push(usernames.slice(i, i + BATCH_SIZE));
  }

  console.log(`[github] Fetching contributions for ${usernames.length} users in ${batches.length} batch(es)`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const aliases = batch.map((username, i) => {
      const safeAlias = `u${i}`;
      return `${safeAlias}: user(login: ${JSON.stringify(username)}) { contributionsCollection { contributionCalendar { totalContributions } } }`;
    });

    const query = `query { ${aliases.join(' ')} }`;

    try {
      const raw = execSync(
        `gh api graphql -f query=${JSON.stringify(query)}`,
        { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const response = JSON.parse(raw);
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

      // Check for errors on individual users
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
      // Mark all users in failed batch as null
      for (const username of batch) {
        if (!(username in results)) {
          results[username] = null;
        }
      }
    }
  }

  return results;
}

module.exports = { fetchContributions };
