/**
 * Periodic Jira sync and feature discovery.
 *
 * fullJiraSync is the primary entry point — it fetches all RHAISTRAT features
 * from Jira, merges with existing store data (preserving pipeline + AI review
 * fields), and writes in a single pass.
 *
 * Legacy functions (syncAllFeatures, discoverFromJira, reconcileTrackingData)
 * are deprecated and will be removed in a future release.
 */

const { discoverFeatures, fetchEpicsForFeatures, fetchSignOffDetails } = require('./jira-enrich');
const { mergeFeatureData, writeFeatures } = require('./feature-store');

const DATA_PREFIX = 'releases/execution';

const FULL_SYNC_JQL = 'project = RHAISTRAT AND issuetype IN (Feature, Initiative)';

/**
 * Full Jira sync — fetches all RHAISTRAT features and merges into the store.
 *
 * 1. Bulk JQL fetch of all features (no `created` filter)
 * 2. Epic discovery for returned keys
 * 3. Sign-off detection merged into main pass
 * 4. Single writeFeatures call (single index rebuild)
 *
 * @param {object} storage - Storage abstraction
 * @param {Function} jiraRequestFn - Bound jiraRequest
 * @param {Function} fetchAllJqlResultsFn - Bound fetchAllJqlResults
 * @returns {Promise<object>} Sync result metadata
 */
async function fullJiraSync(storage, jiraRequestFn, fetchAllJqlResultsFn) {
  const startTime = Date.now();

  console.log('[jira-sync] Starting full Jira sync: ' + FULL_SYNC_JQL);

  // Step 1: Bulk fetch all features from Jira
  const discovered = await discoverFeatures(FULL_SYNC_JQL, jiraRequestFn, fetchAllJqlResultsFn);

  // Guard: if Jira returns 0 results, something is wrong — do NOT wipe the store
  if (!discovered || discovered.length === 0) {
    console.warn('[jira-sync] Jira returned 0 results — skipping sync to avoid wiping store');
    return {
      status: 'skipped',
      message: 'Jira returned 0 results',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    };
  }

  console.log('[jira-sync] Fetched ' + discovered.length + ' features from Jira');

  // Step 2: Fetch epics for all discovered keys
  const keys = [];
  for (let i = 0; i < discovered.length; i++) {
    keys.push(discovered[i].key);
  }

  const epicMap = await fetchEpicsForFeatures(keys, jiraRequestFn, fetchAllJqlResultsFn);

  // Attach epics to discovered features
  for (let i = 0; i < discovered.length; i++) {
    const feature = discovered[i];
    feature.epics = epicMap.get(feature.key) || [];
  }

  // Step 3: Fetch sign-off details BEFORE main write
  let signOffMap = new Map();
  try {
    signOffMap = await fetchSignOffDetails(keys, storage, jiraRequestFn, fetchAllJqlResultsFn);
    if (signOffMap.size > 0) {
      console.log('[jira-sync] Found sign-off details for ' + signOffMap.size + ' features');
    }
  } catch (err) {
    console.warn('[jira-sync] Sign-off detection pass failed:', err.message);
  }

  // Step 4: Merge with existing store data
  let newCount = 0;
  let updatedCount = 0;
  const mergedFeatures = [];

  for (let i = 0; i < discovered.length; i++) {
    const jiraData = discovered[i];
    const existing = await storage.readFromStorage(DATA_PREFIX + '/features/' + jiraData.key + '.json');

    if (!existing) {
      newCount++;
    } else {
      updatedCount++;
    }

    // Merge sign-off data into aiReview if present
    const signOff = signOffMap.get(jiraData.key);
    if (signOff && existing && existing.aiReview) {
      // Will be merged via the existing aiReview on base
      existing.aiReview.approvedBy = signOff.approvedBy;
      existing.aiReview.approvedAt = signOff.approvedAt;
    }

    const merged = mergeFeatureData(existing, null, jiraData);
    mergedFeatures.push(merged);
  }

  // Step 5: Single write + single index rebuild
  await writeFeatures(storage, mergedFeatures);

  const duration = Date.now() - startTime;
  const jiraKeys = new Set(keys);

  const result = {
    status: 'success',
    timestamp: new Date().toISOString(),
    featureCount: discovered.length,
    newCount,
    updatedCount,
    duration
  };

  // Write sync metadata
  await storage.writeToStorage(DATA_PREFIX + '/last-enrichment.json', result);

  console.log('[jira-sync] Full sync complete: ' + discovered.length + ' features (' + newCount + ' new, ' + updatedCount + ' updated) in ' + duration + 'ms');

  return { ...result, jiraKeys };
}

/**
 * Detect features in the store that are no longer in Jira.
 *
 * Only flags features that have `_sources.jira` (i.e., were previously synced
 * from Jira). Pipeline-only features are left alone.
 *
 * Features that reappear in Jira have their `_stale` flag removed.
 *
 * @param {object} storage - Storage abstraction
 * @param {Set<string>} jiraKeys - Set of keys returned by the latest Jira sync
 * @returns {Promise<object>} { staleCount, recoveredCount }
 */
async function detectStaleFeatures(storage, jiraKeys) {
  const fileNames = await storage.listStorageFiles(DATA_PREFIX + '/features');
  if (!fileNames || fileNames.length === 0) {
    return { staleCount: 0, recoveredCount: 0 };
  }

  let staleCount = 0;
  let recoveredCount = 0;
  const toWrite = [];

  for (let i = 0; i < fileNames.length; i++) {
    if (!fileNames[i].endsWith('.json')) continue;

    const key = fileNames[i].replace('.json', '');
    const feature = await storage.readFromStorage(DATA_PREFIX + '/features/' + fileNames[i]);
    if (!feature) continue;

    const inJira = jiraKeys.has(key);
    const wasJiraSourced = feature._sources && feature._sources.jira;

    if (!inJira && wasJiraSourced && !feature._stale) {
      // Mark as stale
      feature._stale = { detectedAt: new Date().toISOString() };
      toWrite.push(feature);
      staleCount++;
    } else if (inJira && feature._stale) {
      // Recovered — remove stale flag
      delete feature._stale;
      toWrite.push(feature);
      recoveredCount++;
    }
  }

  if (toWrite.length > 0) {
    await writeFeatures(storage, toWrite);
  }

  if (staleCount > 0 || recoveredCount > 0) {
    console.log('[jira-sync] Stale detection: ' + staleCount + ' newly stale, ' + recoveredCount + ' recovered');
  }

  return { staleCount, recoveredCount };
}

/**
 * @deprecated Use fullJiraSync instead. Will be removed in a future release.
 *
 * Sync all existing features with fresh Jira data.
 */
async function syncAllFeatures(storage, jiraRequestFn, fetchAllJqlResultsFn) {
  const { enrichFeatures } = require('./jira-enrich');
  const startTime = Date.now();

  // List all feature files
  const fileNames = await storage.listStorageFiles(DATA_PREFIX + '/features');
  if (!fileNames || fileNames.length === 0) {
    return {
      status: 'skipped',
      message: 'No features in store',
      timestamp: new Date().toISOString()
    };
  }

  // Extract keys from filenames
  const keys = [];
  for (let i = 0; i < fileNames.length; i++) {
    if (fileNames[i].endsWith('.json')) {
      keys.push(fileNames[i].replace('.json', ''));
    }
  }

  console.log('[jira-sync] Enriching ' + keys.length + ' features from Jira');

  // Batch-enrich from Jira
  const enrichmentMap = await enrichFeatures(keys, jiraRequestFn, fetchAllJqlResultsFn);

  // Merge and collect
  const mergedFeatures = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const existing = await storage.readFromStorage(DATA_PREFIX + '/features/' + key + '.json');
    const jiraData = enrichmentMap.get(key) || null;
    const merged = mergeFeatureData(existing, null, jiraData);
    mergedFeatures.push(merged);
  }

  // Write all merged features + rebuild index
  await writeFeatures(storage, mergedFeatures);

  // Targeted sign-off detection pass: fetch changelog only for features that
  // have aiReview with humanReviewStatus=approved but no approvedBy/approvedAt
  try {
    const signOffMap = await fetchSignOffDetails(keys, storage, jiraRequestFn, fetchAllJqlResultsFn);
    if (signOffMap.size > 0) {
      const signOffUpdates = [];
      for (const [key, signOff] of signOffMap) {
        const feature = await storage.readFromStorage(DATA_PREFIX + '/features/' + key + '.json');
        if (feature && feature.aiReview) {
          feature.aiReview.approvedBy = signOff.approvedBy;
          feature.aiReview.approvedAt = signOff.approvedAt;
          signOffUpdates.push(feature);
        }
      }
      if (signOffUpdates.length > 0) {
        await writeFeatures(storage, signOffUpdates);
        console.log('[jira-sync] Updated sign-off details for ' + signOffUpdates.length + ' features');
      }
    }
  } catch (err) {
    console.warn('[jira-sync] Sign-off detection pass failed:', err.message);
  }

  const duration = Date.now() - startTime;
  const result = {
    status: 'success',
    timestamp: new Date().toISOString(),
    featureCount: keys.length,
    enrichedCount: enrichmentMap.size,
    duration,
    lastKey: keys[keys.length - 1] || null
  };

  // Write enrichment metadata
  await storage.writeToStorage(DATA_PREFIX + '/last-enrichment.json', result);

  console.log('[jira-sync] Sync complete: ' + enrichmentMap.size + '/' + keys.length + ' enriched in ' + duration + 'ms');

  return result;
}

/**
 * @deprecated Use fullJiraSync instead. Will be removed in a future release.
 *
 * Discover new features from Jira via configurable JQL.
 */
async function discoverFromJira(storage, jiraRequestFn, fetchAllJqlResultsFn, config) {
  const jql = config.discoveryJql ||
    'project = RHAISTRAT AND issuetype IN (Feature, Initiative) AND created >= -365d';

  console.log('[jira-sync] Discovering features from Jira: ' + jql);

  const discovered = await discoverFeatures(jql, jiraRequestFn, fetchAllJqlResultsFn);

  // Check against existing store
  const newFeatures = [];
  for (let i = 0; i < discovered.length; i++) {
    const feature = discovered[i];
    const existing = await storage.readFromStorage(DATA_PREFIX + '/features/' + feature.key + '.json');
    if (!existing) {
      // Create new entry from Jira data
      const merged = mergeFeatureData(null, null, feature);
      newFeatures.push(merged);
    }
  }

  if (newFeatures.length > 0) {
    await writeFeatures(storage, newFeatures);
    console.log('[jira-sync] Discovered ' + newFeatures.length + ' new features from Jira');
  }

  return {
    status: 'success',
    totalDiscovered: discovered.length,
    newFeatures: newFeatures.length
  };
}

/**
 * @deprecated Use fullJiraSync instead. Will be removed in a future release.
 *
 * Reconcile tracking data files — create stub entries for keys not in the store.
 */
async function reconcileTrackingData(storage) {
  // Find all tracking-data-*.json files
  const files = await storage.listStorageFiles(DATA_PREFIX);
  const trackingFiles = [];
  for (let i = 0; i < files.length; i++) {
    if (files[i].startsWith('tracking-data-') && files[i].endsWith('.json')) {
      trackingFiles.push(files[i]);
    }
  }

  const discoveredKeys = new Set();
  for (let i = 0; i < trackingFiles.length; i++) {
    const data = await storage.readFromStorage(DATA_PREFIX + '/' + trackingFiles[i]);
    if (!data || !data.features) continue;

    // data.features is either an array or an object keyed by issue key
    if (Array.isArray(data.features)) {
      for (let j = 0; j < data.features.length; j++) {
        if (data.features[j].key) discoveredKeys.add(data.features[j].key);
      }
    } else {
      for (const key of Object.keys(data.features)) {
        discoveredKeys.add(key);
      }
    }
  }

  // Check which keys don't have feature files yet
  const newFeatures = [];
  for (const key of discoveredKeys) {
    const existing = await storage.readFromStorage(DATA_PREFIX + '/features/' + key + '.json');
    if (!existing) {
      newFeatures.push({
        key,
        summary: '',
        _sources: { tracking: new Date().toISOString() }
      });
    }
  }

  if (newFeatures.length > 0) {
    await writeFeatures(storage, newFeatures);
    console.log('[jira-sync] Reconciled ' + newFeatures.length + ' features from tracking data');
  }

  return {
    trackingFilesScanned: trackingFiles.length,
    totalKeys: discoveredKeys.size,
    newStubs: newFeatures.length
  };
}

module.exports = {
  fullJiraSync,
  detectStaleFeatures,
  syncAllFeatures,
  discoverFromJira,
  reconcileTrackingData,
  DATA_PREFIX,
  FULL_SYNC_JQL
};
