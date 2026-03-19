#!/usr/bin/env node
/**
 * Build nickname-map.json from carltonnorthern/nicknames dataset.
 *
 * Downloads names.csv, builds nickname groups per canonical name, adds
 * international name variation supplements, and writes a flat JSON lookup
 * where every name maps to the set of all names it could be a variation of.
 *
 * Usage: node scripts/build-nickname-map.js
 * Output: server/jira/nickname-map.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CSV_URL = 'https://raw.githubusercontent.com/carltonnorthern/nicknames/master/names.csv';
const OUTPUT_PATH = path.join(__dirname, '..', 'server', 'jira', 'nickname-map.json');

// International name variation supplements
const INTERNATIONAL_SUPPLEMENTS = [
  // Arabic/Islamic
  ['muhammad', 'mohammed', 'mohammad', 'mohamed', 'mohamad'],
  ['ahmed', 'ahmad', 'ahmet'],
  ['abdulrahman', 'abdelrahman'],
  ['hussein', 'husain', 'husein', 'hossein'],
  ['omar', 'umar'],
  ['hassan', 'hasan'],
  // Russian/Slavic
  ['aleksandr', 'aleksander', 'alexander', 'alex', 'sasha', 'aleks'],
  ['dmitri', 'dmitry', 'dmitrii', 'dima'],
  ['mikhail', 'michael', 'misha'],
  ['nikolai', 'nikolay', 'kolya'],
  ['yevgeny', 'evgeny', 'evgenii', 'zhenya'],
  ['sergei', 'sergey', 'sergii'],
  ['vladimir', 'vlad', 'volodya', 'vova'],
  ['anastasia', 'nastya', 'nastia'],
  ['ekaterina', 'katya', 'katerina', 'catherine', 'katherine'],
  ['tatiana', 'tatyana', 'tanya'],
  ['natalia', 'natalya', 'natasha'],
  // Indian
  ['subramaniam', 'subramanian', 'subbu'],
  ['krishna', 'krish'],
  ['rajesh', 'raj'],
  // Spanish/Portuguese
  ['jose', 'josé', 'pepe'],
  ['francisco', 'paco', 'pancho'],
  ['guillermo', 'william', 'memo'],
  ['alejandro', 'alexander', 'alex'],
  ['eduardo', 'edward', 'edu'],
  ['ricardo', 'richard'],
  ['miguel', 'michael'],
  ['carlos', 'charles'],
  // German/European cross-lingual
  ['friedrich', 'fritz', 'frederick', 'fred'],
  ['heinrich', 'henry', 'hans'],
  ['wilhelm', 'william', 'willi'],
  ['johann', 'john', 'hans'],
  ['giuseppe', 'joseph', 'joe'],
  ['giovanni', 'john', 'gianni'],
  ['pierre', 'peter', 'pietro'],
  ['jacques', 'james', 'jacob'],
  ['jean', 'john'],
  ['andreas', 'andrew', 'andré'],
  ['stefan', 'stephen', 'steven'],
  // Korean romanization
  ['joon', 'jun', 'june'],
  ['young', 'yeong'],
  ['hyun', 'hyeon'],
];

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchCSV(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Parse CSV into an array of [canonical, nickname] pairs.
 * CSV format: Name,has_nickname,Nickname
 */
function parseCSV(csv) {
  const pairs = [];
  const lines = csv.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith('name')) continue;
    const parts = trimmed.split(',');
    if (parts.length < 3) continue;
    const canonical = parts[0].trim().toLowerCase();
    const nickname = parts[2].trim().toLowerCase();
    if (canonical && nickname) {
      pairs.push([canonical, nickname]);
    }
  }
  return pairs;
}

/**
 * Build nickname lookup from CSV pairs and international supplements.
 *
 * Strategy: each canonical name + its nicknames form a "group". Each name
 * in the lookup maps to the union of all groups it belongs to. This avoids
 * the mega-group problem of union-find — short nicknames like "al" appear
 * in multiple groups but don't cause those groups to merge.
 *
 * For example: "chris" is in both the "christopher" and "christine" groups,
 * so chris's lookup includes both. But "christopher" and "christine" don't
 * appear in each other's lookups — the "exactly one match" guard in
 * tryUserSearch handles ambiguity.
 */
function buildNicknameMap(pairs, supplements) {
  // Step 1: Build groups — each canonical name → Set of all its names
  const groups = []; // Array of Set<string>

  // From CSV: group each canonical with its nicknames
  const canonicalToGroup = new Map();
  for (const [canonical, nickname] of pairs) {
    if (!canonicalToGroup.has(canonical)) {
      const group = new Set([canonical]);
      canonicalToGroup.set(canonical, group);
      groups.push(group);
    }
    canonicalToGroup.get(canonical).add(nickname);
  }

  // From international supplements: each array is a group
  for (const names of supplements) {
    const group = new Set(names.map(n => n.toLowerCase()));
    groups.push(group);
  }

  // Step 2: Build lookup — each name → union of all groups it belongs to
  // First, index: name → list of groups containing it
  const nameToGroups = new Map();
  for (const group of groups) {
    for (const name of group) {
      if (!nameToGroups.has(name)) {
        nameToGroups.set(name, []);
      }
      nameToGroups.get(name).push(group);
    }
  }

  // Then, for each name, union all its groups
  const lookup = {};
  for (const [name, memberGroups] of nameToGroups) {
    const combined = new Set();
    for (const group of memberGroups) {
      for (const member of group) {
        combined.add(member);
      }
    }
    const sorted = [...combined].sort();
    lookup[name] = sorted;
  }

  return lookup;
}

async function main() {
  console.log('Fetching nicknames CSV...');
  const csv = await fetchCSV(CSV_URL);
  console.log(`Downloaded ${csv.length} bytes`);

  const pairs = parseCSV(csv);
  console.log(`Parsed ${pairs.length} nickname pairs`);

  const lookup = buildNicknameMap(pairs, INTERNATIONAL_SUPPLEMENTS);
  const nameCount = Object.keys(lookup).length;
  console.log(`Built lookup with ${nameCount} name entries`);

  // Spot-check
  const chris = lookup['chris'] || [];
  const christopher = lookup['christopher'] || [];
  console.log(`  chris group (${chris.length}): includes christopher=${chris.includes('christopher')}`);
  console.log(`  christopher group (${christopher.length}): includes chris=${christopher.includes('chris')}`);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(lookup, null, 2) + '\n');
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
