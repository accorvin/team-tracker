/**
 * Patch: Strict GitLab username inference (fixes #1350)
 *
 * Modifies @org-pulse/core's username-inference.js to use strict matching
 * for GitLab usernames. In strict mode, only high-confidence identity
 * signals (profile name, profile email) are used — login-based heuristics
 * (email-prefix, name-pattern) are skipped to prevent false positives
 * from username squatting on gitlab.com.
 *
 * This patch is applied by scripts/setup.js after symlinking core.
 * Remove this patch once @org-pulse/core includes the fix natively.
 */

const fs = require('fs');
const path = require('path');

function apply(coreDir) {
  const filePath = path.join(coreDir, 'shared/server/roster-sync/username-inference.js');
  if (!fs.existsSync(filePath)) return false;

  let content = fs.readFileSync(filePath, 'utf8');

  // Already patched
  if (content.includes('var strict = options && options.strict')) return false;

  // 1. Add options parameter to tryMatch and gate login heuristics behind !strict
  content = content.replace(
    'function tryMatch(person, members) {',
    'function tryMatch(person, members, options) {\n  var strict = options && options.strict;'
  );

  // 2. Wrap login-based heuristics in !strict guard
  content = content.replace(
    '    // Match by login resembling email prefix / uid\n' +
    '    if (emailPrefix && login === emailPrefix) {\n' +
    '      return member.login || member.username;\n' +
    '    }\n' +
    '\n' +
    '    // Match by login containing first+last name patterns\n' +
    '    if (lastLower.length > 2 && firstLower.length > 0) {\n' +
    '      if (login === `${firstLower}${lastLower}` ||\n' +
    '          login === `${firstLower}-${lastLower}` ||\n' +
    '          login === `${firstLower}.${lastLower}` ||\n' +
    '          login === `${firstLower[0]}${lastLower}`) {\n' +
    '        return member.login || member.username;\n' +
    '      }\n' +
    '    }',

    '    if (!strict) {\n' +
    '      // Match by login resembling email prefix / uid\n' +
    '      if (emailPrefix && login === emailPrefix) {\n' +
    '        return member.login || member.username;\n' +
    '      }\n' +
    '\n' +
    '      // Match by login containing first+last name patterns\n' +
    '      if (lastLower.length > 2 && firstLower.length > 0) {\n' +
    '        if (login === `${firstLower}${lastLower}` ||\n' +
    '            login === `${firstLower}-${lastLower}` ||\n' +
    '            login === `${firstLower}.${lastLower}` ||\n' +
    '            login === `${firstLower[0]}${lastLower}`) {\n' +
    '          return member.login || member.username;\n' +
    '        }\n' +
    '      }\n' +
    '    }'
  );

  // 3. Pass strict: true for GitLab inference
  content = content.replace(
    'const match = tryMatch(person, allGitlabMembers);',
    'const match = tryMatch(person, allGitlabMembers, { strict: true });'
  );

  // 4. Export tryMatch for testing
  content = content.replace(
    'module.exports = { inferUsernames };',
    'module.exports = { inferUsernames, _tryMatch: tryMatch };'
  );

  fs.writeFileSync(filePath, content);
  return true;
}

module.exports = { apply };
