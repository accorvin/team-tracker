const express = require('express');
const registerDisconnectedRoutes = require('./disconnected/routes');
const disconnectedScheduler = require('./disconnected/scheduler');
const registerQualityRoutes = require('./quality/routes');
const qualityScheduler = require('./quality/scheduler');

module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope } = context;

  disconnectedScheduler.init(context.secrets);
  qualityScheduler.init(context.secrets);

  context.registerScopes([
    { key: 'system-health:read', label: 'System Health (Read)', description: 'Read system health data', category: 'System Health' },
    { key: 'system-health:write', label: 'System Health (Write)', description: 'Push system health data', category: 'System Health' }
  ]);

  const disconnectedRouter = express.Router();
  registerDisconnectedRoutes(disconnectedRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requireScope,
    scheduler: disconnectedScheduler
  });
  router.use('/disconnected', disconnectedRouter);

  const qualityRouter = express.Router();
  registerQualityRoutes(qualityRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requireScope,
    scheduler: qualityScheduler
  });
  router.use('/quality', qualityRouter);

  if (context.registerRefresh) {
    context.registerRefresh('disconnected-readiness', {
      order: 80,
      timeout: 600000,
      cadence: '1h',
      description: 'Fetches disconnected readiness reports from GitHub Actions artifacts.',
      handler: async function() {
        return disconnectedScheduler.runFetch(storage);
      }
    });

    context.registerRefresh('quality-reports', {
      order: 85,
      timeout: 600000,
      cadence: '24h',
      description: 'Fetches quality analysis reports from GitLab CI pipeline artifacts.',
      handler: async function() {
        return qualityScheduler.runFetch(storage);
      }
    });
  }

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const disconnectedData = await storage.readFromStorage('system-health/disconnected/reports.json');
      const disconnectedLastFetch = await storage.readFromStorage('system-health/disconnected/last-fetch.json');
      const qualityData = await storage.readFromStorage('system-health/quality/reports.json');
      const qualityLastFetch = await storage.readFromStorage('system-health/quality/last-fetch.json');
      return {
        disconnected: {
          dataAvailable: !!(disconnectedData && disconnectedData.repos && Object.keys(disconnectedData.repos).length > 0),
          repoCount: disconnectedData ? Object.keys(disconnectedData.repos || {}).length : 0,
          fetchedAt: disconnectedData ? disconnectedData.lastSyncedAt : null,
          lastFetchStatus: disconnectedLastFetch ? disconnectedLastFetch.status : null,
          tokenSource: disconnectedScheduler.getTokenSource()
        },
        quality: {
          dataAvailable: !!(qualityData && qualityData.reports && Object.keys(qualityData.reports).length > 0),
          repoCount: qualityData ? Object.keys(qualityData.reports || {}).length : 0,
          fetchedAt: qualityData ? qualityData.lastSyncedAt : null,
          lastFetchStatus: qualityLastFetch ? qualityLastFetch.status : null,
          tokenSource: qualityScheduler.getTokenSource()
        }
      };
    });
  }
};
