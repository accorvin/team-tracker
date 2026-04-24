module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage, listStorageFiles } = storage;

  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  const { JIRA_HOST, jiraRequest } = require('../../../shared/server/jira');

  const { fetchRFEData } = require('./jira/rfe-fetcher');
  const { resolveLinkedFeatures } = require('./jira/link-resolver');
  const { getConfig, saveConfig } = require('./config');
  const { computeAllMetrics } = require('./metrics');
  const { fetchAutofixData, computeAutofixMetrics, buildTrendData: buildAutofixTrend } = require('./jira/autofix-fetcher');
  const { fetchAllPRData, fetchRepoPRData, reclassifyBotFields } = require('./github/pr-fetcher');
  const { computePRMetrics } = require('./pr-metrics');

  const registerAssessmentRoutes = require('./assessments/routes');
  registerAssessmentRoutes(router, context);

  const registerFeatureRoutes = require('./features/routes');
  registerFeatureRoutes(router, context);

  // ─── Per-repo storage helpers ───

  const PR_DATA_DIR = 'ai-impact/pr-data';
  const AGGREGATE_CACHE_KEY = 'ai-impact/pr-metrics-aggregate.json';

  function repoSlugToFilename(repoSlug) {
    return repoSlug.replace('/', '--') + '.json';
  }

  function filenameToRepoSlug(filename) {
    const base = filename.endsWith('.json') ? filename.slice(0, -5) : filename;
    const idx = base.indexOf('--');
    if (idx === -1) return base;
    return base.slice(0, idx) + '/' + base.slice(idx + 2);
  }

  function readRepoData(repoSlug) {
    return readFromStorage(PR_DATA_DIR + '/' + repoSlugToFilename(repoSlug));
  }

  function writeRepoData(repoSlug, data) {
    writeToStorage(PR_DATA_DIR + '/' + repoSlugToFilename(repoSlug), data);
  }

  function deleteRepoData(repoSlug) {
    writeToStorage(PR_DATA_DIR + '/' + repoSlugToFilename(repoSlug), null);
  }

  function listRepoFiles() {
    return listStorageFiles(PR_DATA_DIR);
  }

  function invalidateAggregateCache() {
    writeToStorage(AGGREGATE_CACHE_KEY, null);
  }

  function readAllRepoData(configuredRepos) {
    const files = listRepoFiles();
    const allowedSet = configuredRepos ? new Set(configuredRepos) : null;
    const repos = [];
    const allPRs = [];
    let oldestDataStart = null;
    for (const f of files) {
      const slug = filenameToRepoSlug(f);
      if (allowedSet && !allowedSet.has(slug)) continue;
      const data = readFromStorage(PR_DATA_DIR + '/' + f);
      if (data) {
        repos.push({ repo: slug, lastFetchedAt: data.lastFetchedAt || null, dataStartDate: data.dataStartDate || null, lastError: data.lastError || null, prCount: (data.pullRequests || []).length });
        if (data.dataStartDate && (!oldestDataStart || data.dataStartDate < oldestDataStart)) {
          oldestDataStart = data.dataStartDate;
        }
        for (const pr of (data.pullRequests || [])) {
          allPRs.push(pr);
        }
      }
    }
    return { repos, allPRs, dataStartDate: oldestDataStart };
  }

  // ─── Refresh state (in-memory) ───

  const refreshState = {
    running: false,
    startedAt: null,
    lastResult: null
  };

  const prRefreshState = {
    running: false,
    startedAt: null,
    currentRepo: null,
    reposCompleted: 0,
    reposTotal: 0,
    lastResult: null,
    repoResults: null
  };

  // ─── Routes ───

  const VALID_TIME_WINDOWS = ['week', 'month', '3months'];

  router.get('/rfe-data', function(req, res) {
    const timeWindow = VALID_TIME_WINDOWS.includes(req.query.timeWindow)
      ? req.query.timeWindow
      : 'month';

    const data = readFromStorage('ai-impact/rfe-data.json');
    if (!data || !data.issues) {
      return res.json({
        fetchedAt: null,
        jiraHost: JIRA_HOST,
        metrics: { createdPct: 0, createdChange: 0, trend: 'stable', revisedCount: 0, priorRevisedCount: 0, windowTotal: 0, totalRFEs: 0 },
        trendData: [],
        breakdown: [],
        issues: []
      });
    }

    const config = getConfig(readFromStorage);
    const { metrics, trendData, breakdown } = computeAllMetrics(data.issues, timeWindow, config);

    res.json({
      fetchedAt: data.fetchedAt,
      jiraHost: JIRA_HOST,
      metrics,
      trendData,
      breakdown,
      issues: data.issues
    });
  });

  // ─── Autofix data ───

  const VALID_AUTOFIX_TIME_WINDOWS = ['week', 'month', '3months'];

  router.get('/autofix-data', function(req, res) {
    const timeWindow = VALID_AUTOFIX_TIME_WINDOWS.includes(req.query.timeWindow)
      ? req.query.timeWindow
      : 'month';

    const data = readFromStorage('ai-impact/autofix-data.json');
    if (!data || !data.issues) {
      return res.json({
        fetchedAt: null,
        jiraHost: JIRA_HOST,
        metrics: { triageTotal: 0, triageVerdicts: {}, autofixStates: {}, autofixTotal: 0, successRate: 0, windowTotal: 0, totalIssues: 0 },
        trendData: [],
        issues: []
      });
    }

    const metrics = computeAutofixMetrics(data.issues, timeWindow);
    const trendData = buildAutofixTrend(data.issues, timeWindow);

    res.json({
      fetchedAt: data.fetchedAt,
      jiraHost: JIRA_HOST,
      metrics,
      trendData,
      issues: data.issues
    });
  });

  // ─── PR data (per-repo or aggregate) ───

  const EMPTY_METRICS = Object.freeze({
    medianCycleTimeHours: 0, p90CycleTimeHours: 0,
    priorMedianCycleTimeHours: 0, priorP90CycleTimeHours: 0,
    mergedCount: 0, priorMergedCount: 0, totalMerged: 0, openCount: 0,
    aging: Object.freeze({ best: 0, green: 0, yellow: 0, orange: 0, red: 0 }),
    aiThreadCount: 0, humanThreadCount: 0, aiReviewPct: 0,
    priorAiThreadCount: 0, priorHumanThreadCount: 0, priorAiReviewPct: 0,
    openedCount: 0, priorOpenedCount: 0, hasSufficientHistory: false
  });

  router.get('/pr-data', function(req, res) {
    const timeWindow = VALID_TIME_WINDOWS.includes(req.query.timeWindow)
      ? req.query.timeWindow
      : 'month';
    const repoParam = req.query.repo;

    if (repoParam) {
      if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repoParam)) {
        return res.status(400).json({ error: 'Invalid repo format' });
      }
      const data = readRepoData(repoParam);
      if (!data || !data.pullRequests) {
        return res.json({
          fetchedAt: null,
          repo: repoParam,
          lastFetchedAt: null,
          metrics: EMPTY_METRICS,
          trendData: [],
          sizeBuckets: [],
          pullRequests: []
        });
      }

      const { metrics, trendData, sizeBuckets } = computePRMetrics(data.pullRequests, timeWindow, { dataStartDate: data.dataStartDate });
      return res.json({
        fetchedAt: data.lastFetchedAt,
        repo: repoParam,
        lastFetchedAt: data.lastFetchedAt,
        metrics,
        trendData,
        sizeBuckets,
        pullRequests: data.pullRequests
      });
    }

    // Aggregate view: metrics across all repos, no pullRequests array
    const cached = readFromStorage(AGGREGATE_CACHE_KEY);
    if (cached && cached[timeWindow]) {
      return res.json(cached[timeWindow]);
    }

    // Compute aggregate from configured repo files only
    const config = getConfig(readFromStorage);
    const { repos, allPRs, dataStartDate } = readAllRepoData(config.prRepos);

    if (allPRs.length === 0) {
      return res.json({
        fetchedAt: null,
        repos: repos,
        metrics: EMPTY_METRICS,
        trendData: [],
        sizeBuckets: []
      });
    }

    // Compute for all 3 time windows and cache
    const cacheObj = {};
    for (const tw of VALID_TIME_WINDOWS) {
      const computed = computePRMetrics(allPRs, tw, { dataStartDate });
      cacheObj[tw] = {
        fetchedAt: new Date().toISOString(),
        repos,
        metrics: computed.metrics,
        trendData: computed.trendData,
        sizeBuckets: computed.sizeBuckets
      };
    }
    writeToStorage(AGGREGATE_CACHE_KEY, cacheObj);

    res.json(cacheObj[timeWindow]);
  });

  // ─── PR refresh ───

  router.get('/pr-refresh/status', function(req, res) {
    res.json(prRefreshState);
  });

  router.post('/pr-refresh', requireAdmin, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' });
    }
    if (prRefreshState.running) {
      return res.json({ status: 'already_running' });
    }

    const config = getConfig(readFromStorage);
    if (!config.prRepos || config.prRepos.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No repos configured' });
    }

    prRefreshState.running = true;
    prRefreshState.startedAt = new Date().toISOString();
    prRefreshState.reposCompleted = 0;
    prRefreshState.reposTotal = config.prRepos.length;
    prRefreshState.currentRepo = null;
    prRefreshState.repoResults = null;
    res.json({ status: 'started' });

    try {
      const result = await fetchAllPRData(config, { readRepoData, writeRepoData }, function(repoSlug, index) {
        prRefreshState.currentRepo = repoSlug;
        prRefreshState.reposCompleted = index;
      });

      invalidateAggregateCache();
      prRefreshState.reposCompleted = config.prRepos.length;
      prRefreshState.repoResults = result.repoResults;

      const totalPRs = result.repoResults.reduce(function(sum, r) { return sum + (r.prCount || 0); }, 0);
      const failedCount = result.repoResults.filter(function(r) { return r.status === 'failed'; }).length;
      const partialCount = result.repoResults.filter(function(r) { return r.status === 'partial'; }).length;

      let statusMsg = 'success';
      if (failedCount > 0 || partialCount > 0) statusMsg = 'partial';

      prRefreshState.lastResult = {
        status: statusMsg,
        message: totalPRs + ' PRs across ' + config.prRepos.length + ' repos' +
          (failedCount > 0 ? ' (' + failedCount + ' failed)' : '') +
          (partialCount > 0 ? ' (' + partialCount + ' partial)' : ''),
        completedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('[ai-impact] PR refresh failed:', err);
      prRefreshState.lastResult = {
        status: 'error',
        message: err.message,
        completedAt: new Date().toISOString()
      };
    } finally {
      prRefreshState.running = false;
      prRefreshState.currentRepo = null;
    }
  });

  // ─── Per-repo PR refresh ───

  router.post('/pr-refresh/repo', requireAdmin, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' });
    }
    if (prRefreshState.running) {
      return res.json({ status: 'already_running' });
    }

    const repoSlug = req.body.repo;
    const force = req.body.force === true;
    if (!repoSlug || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repoSlug)) {
      return res.status(400).json({ status: 'error', message: 'Invalid repo format' });
    }

    const config = getConfig(readFromStorage);
    const parts = repoSlug.split('/');

    prRefreshState.running = true;
    prRefreshState.startedAt = new Date().toISOString();
    prRefreshState.currentRepo = repoSlug;
    prRefreshState.reposCompleted = 0;
    prRefreshState.reposTotal = 1;
    res.json({ status: 'started' });

    try {
      const existingData = force ? null : readRepoData(repoSlug);

      const result = await fetchRepoPRData(parts[0], parts[1], config, existingData, {
        force: force,
        onChunkComplete: function(data) {
          writeRepoData(repoSlug, data);
        }
      });

      writeRepoData(repoSlug, {
        lastFetchedAt: result.lastFetchedAt,
        dataStartDate: result.dataStartDate,
        lastError: null,
        pullRequests: result.pullRequests
      });

      invalidateAggregateCache();
      prRefreshState.reposCompleted = 1;
      prRefreshState.repoResults = [{ repo: repoSlug, status: result.status, prCount: result.pullRequests.length }];
      prRefreshState.lastResult = {
        status: result.status === 'complete' ? 'success' : 'partial',
        message: result.pullRequests.length + ' PRs for ' + repoSlug +
          (result.error ? ' (error: ' + result.error + ')' : ''),
        completedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('[ai-impact] PR repo refresh failed:', err);
      writeRepoData(repoSlug, {
        lastFetchedAt: null,
        lastError: { message: err.message, at: new Date().toISOString() },
        pullRequests: []
      });
      invalidateAggregateCache();
      prRefreshState.lastResult = {
        status: 'error',
        message: err.message,
        completedAt: new Date().toISOString()
      };
    } finally {
      prRefreshState.running = false;
      prRefreshState.currentRepo = null;
    }
  });

  // ─── PR data management ───

  router.delete('/pr-data/cache', requireAdmin, function(req, res) {
    invalidateAggregateCache();
    res.json({ status: 'cleared' });
  });

  router.post('/pr-data/prune', requireAdmin, function(req, res) {
    const olderThanDays = Number(req.body.olderThanDays);
    const removeAll = olderThanDays === 0;
    if (!removeAll && (!olderThanDays || olderThanDays < 1)) {
      return res.status(400).json({ error: 'olderThanDays must be 0 (all) or a positive number' });
    }

    const dryRun = req.query.dryRun === 'true';
    const cutoff = removeAll ? null : new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let totalRemoved = 0;
    let reposAffected = 0;

    const files = listRepoFiles();
    for (const f of files) {
      const data = readFromStorage(PR_DATA_DIR + '/' + f);
      if (!data || !data.pullRequests) continue;

      const before = data.pullRequests.length;
      if (before === 0) continue;

      if (removeAll) {
        totalRemoved += before;
        reposAffected++;
        if (!dryRun) {
          data.pullRequests = [];
          data.dataStartDate = null;
          data.lastFetchedAt = null;
          writeToStorage(PR_DATA_DIR + '/' + f, data);
        }
        continue;
      }

      const kept = data.pullRequests.filter(function(pr) {
        const dateStr = pr.state === 'merged' ? pr.mergedAt
          : pr.state === 'closed' ? pr.closedAt
          : pr.createdAt;
        if (!dateStr) return true;
        return new Date(dateStr) >= cutoff;
      });

      const removed = before - kept.length;
      if (removed > 0) {
        totalRemoved += removed;
        reposAffected++;
      }
      if (!dryRun && removed > 0) {
        data.pullRequests = kept;
        if (kept.length === 0) {
          data.dataStartDate = null;
          data.lastFetchedAt = null;
        } else if (!data.dataStartDate || new Date(data.dataStartDate) < cutoff) {
          data.dataStartDate = cutoff.toISOString();
        }
        writeToStorage(PR_DATA_DIR + '/' + f, data);
      } else if (!dryRun && (!data.dataStartDate || new Date(data.dataStartDate) < cutoff)) {
        data.dataStartDate = cutoff.toISOString();
        writeToStorage(PR_DATA_DIR + '/' + f, data);
      }
    }

    if (!dryRun) {
      invalidateAggregateCache();
    }

    if (dryRun) {
      res.json({ wouldRemove: totalRemoved, repos: reposAffected });
    } else {
      res.json({ removed: totalRemoved, repos: reposAffected });
    }
  });

  router.delete('/pr-data/repo', requireAdmin, function(req, res) {
    const repoSlug = req.query.repo || (req.body && req.body.repo);
    if (!repoSlug || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repoSlug)) {
      return res.status(400).json({ error: 'repo is required and must match owner/repo format' });
    }
    deleteRepoData(repoSlug);
    invalidateAggregateCache();
    res.json({ status: 'deleted', repo: repoSlug });
  });

  // ─── Config ───

  router.get('/config', requireAdmin, function(req, res) {
    res.json(getConfig(readFromStorage));
  });

  router.post('/config', requireAdmin, function(req, res) {
    try {
      const oldConfig = getConfig(readFromStorage);
      saveConfig(writeToStorage, req.body);
      const newConfig = getConfig(readFromStorage);

      const oldBots = JSON.stringify((oldConfig.prBotUsernames || []).sort());
      const newBots = JSON.stringify((newConfig.prBotUsernames || []).sort());
      if (oldBots !== newBots) {
        console.log('[ai-impact] Bot usernames changed, reclassifying cached PRs...');
        const files = listRepoFiles();
        for (const f of files) {
          const data = readFromStorage(PR_DATA_DIR + '/' + f);
          if (data && data.pullRequests) {
            data.pullRequests = reclassifyBotFields(data.pullRequests, newConfig.prBotUsernames);
            writeToStorage(PR_DATA_DIR + '/' + f, data);
          }
        }
        invalidateAggregateCache();
        console.log('[ai-impact] Reclassified ' + files.length + ' repo files');
      }

      const oldRepos = JSON.stringify((oldConfig.prRepos || []).slice().sort());
      const newRepos = JSON.stringify((newConfig.prRepos || []).slice().sort());
      if (oldRepos !== newRepos) {
        invalidateAggregateCache();
      }

      res.json({ status: 'saved' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Jira cache clear (no longer touches PR data) ───

  router.delete('/cache', requireAdmin, function(req, res) {
    writeToStorage('ai-impact/rfe-data.json', null);
    writeToStorage('ai-impact/autofix-data.json', null);
    res.json({ status: 'cleared' });
  });

  // ─── Jira refresh ───

  router.get('/refresh/status', function(req, res) {
    res.json(refreshState);
  });

  router.post('/refresh', requireAdmin, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' });
    }
    if (refreshState.running) {
      return res.json({ status: 'already_running' });
    }
    refreshState.running = true;
    refreshState.startedAt = new Date().toISOString();
    res.json({ status: 'started' });

    try {
      const config = getConfig(readFromStorage);

      const issues = await fetchRFEData(jiraRequest, config);
      const withLinks = await resolveLinkedFeatures(jiraRequest, issues, config);
      writeToStorage('ai-impact/rfe-data.json', {
        fetchedAt: new Date().toISOString(),
        issues: withLinks
      });

      let autofixCount = 0;
      try {
        const autofixIssues = await fetchAutofixData(jiraRequest, config);
        writeToStorage('ai-impact/autofix-data.json', {
          fetchedAt: new Date().toISOString(),
          issues: autofixIssues
        });
        autofixCount = autofixIssues.length;
      } catch (autofixErr) {
        console.error('[ai-impact] Autofix data refresh failed:', autofixErr.message);
      }

      refreshState.lastResult = {
        status: 'success',
        message: `Fetched ${withLinks.length} RFEs, ${autofixCount} autofix issues`,
        completedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('[ai-impact] Refresh failed:', err);
      refreshState.lastResult = {
        status: 'error',
        message: err.message,
        completedAt: new Date().toISOString()
      };
    } finally {
      refreshState.running = false;
    }
  });

  // ─── Diagnostics ───

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const rfeData = readFromStorage('ai-impact/rfe-data.json');
      const autofixData = readFromStorage('ai-impact/autofix-data.json');
      const repoFiles = listRepoFiles();
      let totalPRs = 0;
      for (const f of repoFiles) {
        const d = readFromStorage(PR_DATA_DIR + '/' + f);
        if (d && d.pullRequests) totalPRs += d.pullRequests.length;
      }
      return {
        refreshState,
        prRefreshState,
        rfe: {
          dataExists: !!rfeData,
          issueCount: rfeData?.issues?.length || 0,
          fetchedAt: rfeData?.fetchedAt || null
        },
        autofix: {
          dataExists: !!autofixData,
          issueCount: autofixData?.issues?.length || 0,
          fetchedAt: autofixData?.fetchedAt || null
        },
        pr: {
          repoFiles: repoFiles.length,
          totalPRs: totalPRs
        }
      };
    });
  }
};
