/**
 * Compute PR velocity metrics from cached PR data.
 *
 * Computed on-read at request time (same pattern as metrics.js).
 * Takes a timeWindow parameter to control the analysis period.
 */

function getTimeWindowDays(timeWindow) {
  if (timeWindow === 'week') return 7;
  if (timeWindow === '3months') return 90;
  return 30; // 'month' default
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

const BUCKET_ORDER = ['XS', 'S', 'M', 'L', 'XL'];

function computePRMetrics(pullRequests, timeWindow, options) {
  const days = getTimeWindowDays(timeWindow);
  const now = Date.now();
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
  const priorCutoff = new Date(cutoff.getTime() - days * 24 * 60 * 60 * 1000);

  const allMerged = pullRequests.filter(pr => pr.state === 'merged');
  const allOpen = pullRequests.filter(pr => pr.state === 'open');
  const allClosed = pullRequests.filter(pr => pr.state === 'closed');

  const windowMerged = allMerged.filter(pr => new Date(pr.mergedAt) >= cutoff);
  const priorMerged = allMerged.filter(pr => {
    const d = new Date(pr.mergedAt);
    return d >= priorCutoff && d < cutoff;
  });

  // Cycle times for window
  const cycleTimes = windowMerged
    .filter(pr => pr.cycleTimeHours != null)
    .map(pr => pr.cycleTimeHours);

  const medianCycleTimeHours = Math.round(median(cycleTimes) * 10) / 10;
  const p90CycleTimeHours = Math.round(percentile(cycleTimes, 90) * 10) / 10;

  // Prior period cycle times for comparison
  const priorCycleTimes = priorMerged
    .filter(pr => pr.cycleTimeHours != null)
    .map(pr => pr.cycleTimeHours);
  const priorMedianCycleTimeHours = Math.round(median(priorCycleTimes) * 10) / 10;
  const priorP90CycleTimeHours = Math.round(percentile(priorCycleTimes, 90) * 10) / 10;

  // Open PR aging (based on time since creation)
  const aging = { best: 0, green: 0, yellow: 0, orange: 0, red: 0 };
  for (const pr of allOpen) {
    const hoursSinceCreated = (now - new Date(pr.createdAt).getTime()) / 3600000;
    if (hoursSinceCreated < 24) aging.best++;
    else if (hoursSinceCreated < 48) aging.green++;
    else if (hoursSinceCreated < 168) aging.yellow++;
    else if (hoursSinceCreated < 336) aging.orange++;
    else aging.red++;
  }

  // Review thread aggregates (window + prior)
  // AI review activity is measured by review threads (inline code discussions),
  // not review-level comments, because tools like CodeRabbit post feedback as threads.
  const windowPRs = [...windowMerged, ...allOpen];
  const aiThreadCount = windowPRs.reduce((s, pr) => s + (pr.aiThreads?.total || 0), 0);
  const totalThreadCount = windowPRs.reduce((s, pr) => s + (pr.totalReviewThreads || 0), 0);
  const humanThreadCount = totalThreadCount - aiThreadCount;
  const aiReviewPct = totalThreadCount > 0 ? Math.round((aiThreadCount / totalThreadCount) * 100) : 0;

  const priorWindowPRs = [...priorMerged, ...allOpen];
  const priorAiThreadCount = priorWindowPRs.reduce((s, pr) => s + (pr.aiThreads?.total || 0), 0);
  const priorTotalThreadCount = priorWindowPRs.reduce((s, pr) => s + (pr.totalReviewThreads || 0), 0);
  const priorHumanThreadCount = priorTotalThreadCount - priorAiThreadCount;
  const priorAiReviewPct = priorTotalThreadCount > 0
    ? Math.round((priorAiThreadCount / priorTotalThreadCount) * 100) : 0;

  // PRs opened in window (created, regardless of current state)
  const openedInWindow = pullRequests.filter(pr => new Date(pr.createdAt) >= cutoff);
  const openedInPrior = pullRequests.filter(pr => {
    const d = new Date(pr.createdAt);
    return d >= priorCutoff && d < cutoff;
  });

  // Weekly trend data
  const weekCounts = timeWindow === 'week' ? 4 : timeWindow === 'month' ? 8 : 13;
  const trendData = [];
  for (let w = weekCounts - 1; w >= 0; w--) {
    const weekEnd = new Date(now - w * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekMerged = allMerged.filter(pr => {
      const d = new Date(pr.mergedAt);
      return d >= weekStart && d < weekEnd;
    });

    const weekOpened = pullRequests.filter(pr => {
      const d = new Date(pr.createdAt);
      return d >= weekStart && d < weekEnd;
    });

    const weekClosed = allClosed.filter(pr => {
      const d = new Date(pr.closedAt);
      return d >= weekStart && d < weekEnd;
    });

    const weekCycleTimes = weekMerged
      .filter(pr => pr.cycleTimeHours != null)
      .map(pr => pr.cycleTimeHours);

    // Per-size-bucket median cycle time for this week
    const sizeCycleTimes = {};
    for (const bucket of BUCKET_ORDER) {
      const bucketCTs = weekMerged
        .filter(pr => pr.sizeBucket === bucket && pr.cycleTimeHours != null)
        .map(pr => pr.cycleTimeHours);
      if (bucketCTs.length > 0) {
        sizeCycleTimes[bucket] = Math.round(median(bucketCTs) * 10) / 10;
      }
    }

    const weekAiThreads = weekMerged.reduce(function(s, pr) { return s + (pr.aiThreads?.total || 0); }, 0);
    const weekTotalThreads = weekMerged.reduce(function(s, pr) { return s + (pr.totalReviewThreads || 0); }, 0);

    const weekLinesChanged = weekMerged.map(pr => (pr.additions || 0) + (pr.deletions || 0));

    trendData.push({
      weekEnding: weekEnd.toISOString().slice(0, 10),
      medianCycleTimeHours: Math.round(median(weekCycleTimes) * 10) / 10,
      mergedCount: weekMerged.length,
      openedCount: weekOpened.length,
      closedCount: weekClosed.length,
      sizeCycleTimes,
      aiThreadCount: weekAiThreads,
      humanThreadCount: weekTotalThreads - weekAiThreads,
      medianLinesChanged: weekLinesChanged.length > 0 ? Math.round(median(weekLinesChanged)) : null
    });
  }

  // Size distribution with per-bucket median cycle time
  const sizeBuckets = BUCKET_ORDER.map(bucket => {
    const bucketPRs = windowMerged.filter(pr => pr.sizeBucket === bucket);
    const bucketCycleTimes = bucketPRs
      .filter(pr => pr.cycleTimeHours != null)
      .map(pr => pr.cycleTimeHours);
    return {
      bucket,
      count: bucketPRs.length,
      medianCycleTimeHours: Math.round(median(bucketCycleTimes) * 10) / 10
    };
  });

  // Determine if we have enough history for prior-period comparisons (need 2x the window).
  // Uses dataStartDate from the repo file (set at first fetch) rather than scanning PR dates.
  const dataStartDate = options?.dataStartDate || null;
  const dataSpanMs = dataStartDate ? (now - new Date(dataStartDate).getTime()) : 0;
  const hasSufficientHistory = dataSpanMs >= (days * 2 * 24 * 60 * 60 * 1000);

  return {
    metrics: {
      medianCycleTimeHours,
      p90CycleTimeHours,
      priorMedianCycleTimeHours,
      priorP90CycleTimeHours,
      mergedCount: windowMerged.length,
      priorMergedCount: priorMerged.length,
      totalMerged: allMerged.length,
      openCount: allOpen.length,
      aging,
      aiThreadCount,
      humanThreadCount,
      aiReviewPct,
      priorAiThreadCount,
      priorHumanThreadCount,
      priorAiReviewPct,
      openedCount: openedInWindow.length,
      priorOpenedCount: openedInPrior.length,
      hasSufficientHistory
    },
    trendData,
    sizeBuckets
  };
}

module.exports = { computePRMetrics, getTimeWindowDays };
