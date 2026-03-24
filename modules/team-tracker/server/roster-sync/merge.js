/**
 * Merge LDAP org tree with Google Sheets enrichment data.
 * Pure function — does not read/write storage.
 */

const { normalizeNameForMatch } = require('./sheets');

/**
 * Enrich a single person with Sheets data.
 * Dynamically copies all fields from the sheets entry onto the person object.
 */
function enrichPerson(person, sheetsMap) {
  const normalized = normalizeNameForMatch(person.name);
  const ssData = sheetsMap.get(normalized);
  if (!ssData) return;

  const primary = Array.isArray(ssData) ? ssData[0] : ssData;

  // Copy all fields from sheet data onto the person (except internal fields)
  for (const [key, value] of Object.entries(primary)) {
    if (key === 'originalName') continue;
    person[key] = value;
  }

  if (Array.isArray(ssData) && ssData.length > 1) {
    person.additionalAssignments = ssData.slice(1).map(function(e) {
      const assignment = {};
      for (const [key, value] of Object.entries(e)) {
        if (key === 'originalName' || key === 'sourceSheet') continue;
        assignment[key] = value;
      }
      return assignment;
    });
  }
}

/**
 * Build the full roster object from LDAP data + Sheets enrichment.
 *
 * @param {Array} orgRoots - Array of { uid, name, displayName }
 * @param {Object} ldapOrgs - Map of uid -> { leader, members }
 * @param {Map} sheetsData - Map of normalized name -> enrichment data (or null)
 * @param {Object} vpInfo - { name, uid } for the VP (optional)
 * @returns {Object} org-roster-full.json format
 */
function buildRoster(orgRoots, ldapOrgs, sheetsData, vpInfo) {
  const roster = {
    generatedAt: new Date().toISOString(),
    vp: vpInfo || null,
    orgs: {}
  };

  for (const root of orgRoots) {
    const orgData = ldapOrgs[root.uid];
    if (!orgData) continue;

    // Enrich with Sheets data if available
    if (sheetsData) {
      enrichPerson(orgData.leader, sheetsData);
      for (const member of orgData.members) {
        enrichPerson(member, sheetsData);
      }
    }

    roster.orgs[root.uid] = {
      leader: orgData.leader,
      members: orgData.members
    };
  }

  return roster;
}

module.exports = {
  buildRoster,
  enrichPerson
};
