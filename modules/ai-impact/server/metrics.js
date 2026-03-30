/**
 * Compute adoption metrics for a given time window.
 *
 * @param {Array} issues - Cached RFE issue list
 * @param {string} timeWindow - 'week' | 'month' | '3months'
 * @param {object} config - Module config (for trendThresholdPp)
 * @returns {{ metrics, trendData, breakdown }}
 */
function computeAllMetrics(issues, timeWindow, config) {
  const { cutoff } = getTimeWindowDates(new Date(), timeWindow);
  const windowIssues = issues.filter(i => new Date(i.created) >= cutoff);
  return {
    metrics: computeMetrics(issues, timeWindow, config),
    trendData: buildTrendData(issues, timeWindow),
    breakdown: buildBreakdownData(windowIssues)
  };
}

function getTimeWindowDates(now, timeWindow) {
  const days = timeWindow === 'week' ? 7 : timeWindow === 'month' ? 30 : 90;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const priorCutoff = new Date(cutoff.getTime() - days * 24 * 60 * 60 * 1000);
  return { cutoff, priorCutoff };
}

function computeMetrics(issues, timeWindow, config) {
  const threshold = config?.trendThresholdPp || 2;
  const now = new Date();
  const { cutoff, priorCutoff } = getTimeWindowDates(now, timeWindow);

  const currentIssues = issues.filter(i => new Date(i.created) >= cutoff);
  const priorIssues = issues.filter(i => {
    const d = new Date(i.created);
    return d >= priorCutoff && d < cutoff;
  });

  const currentCreated = currentIssues.filter(i =>
    i.aiInvolvement === 'created' || i.aiInvolvement === 'both').length;
  const currentAssessed = currentIssues.filter(i =>
    i.aiInvolvement === 'assessed' || i.aiInvolvement === 'both').length;
  const currentTotal = currentIssues.length;

  const priorCreated = priorIssues.filter(i =>
    i.aiInvolvement === 'created' || i.aiInvolvement === 'both').length;
  const priorAssessed = priorIssues.filter(i =>
    i.aiInvolvement === 'assessed' || i.aiInvolvement === 'both').length;
  const priorTotal = priorIssues.length;

  const createdPct = currentTotal > 0 ? Math.round((currentCreated / currentTotal) * 100) : 0;
  const assessedPct = currentTotal > 0 ? Math.round((currentAssessed / currentTotal) * 100) : 0;
  const priorCreatedPct = priorTotal > 0 ? Math.round((priorCreated / priorTotal) * 100) : 0;
  const priorAssessedPct = priorTotal > 0 ? Math.round((priorAssessed / priorTotal) * 100) : 0;

  const createdChange = createdPct - priorCreatedPct;
  const assessedChange = assessedPct - priorAssessedPct;
  const trend = createdChange > threshold ? 'growing' : createdChange < -threshold ? 'declining' : 'stable';
  const assessedTrend = assessedChange > threshold ? 'growing' : assessedChange < -threshold ? 'declining' : 'stable';

  return {
    createdPct, assessedPct, createdChange, assessedChange, trend, assessedTrend,
    windowTotal: currentTotal,
    totalRFEs: issues.length
  };
}

function buildTrendData(issues, timeWindow) {
  const weekCounts = timeWindow === 'week' ? 4 : timeWindow === 'month' ? 8 : 13;
  const now = new Date();
  const points = [];

  for (let w = weekCounts - 1; w >= 0; w--) {
    const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekIssues = issues.filter(i => {
      const d = new Date(i.created);
      return d >= weekStart && d < weekEnd;
    });
    const total = weekIssues.length;
    const createdWithAI = weekIssues.filter(i =>
      i.aiInvolvement === 'created' || i.aiInvolvement === 'both').length;
    const assessedWithAI = weekIssues.filter(i =>
      i.aiInvolvement === 'assessed' || i.aiInvolvement === 'both').length;

    points.push({
      date: weekEnd.toISOString().slice(0, 10),
      createdPct: total > 0 ? Math.round((createdWithAI / total) * 100) : 0,
      assessedPct: total > 0 ? Math.round((assessedWithAI / total) * 100) : 0,
      total
    });
  }

  return points;
}

function buildBreakdownData(issues) {
  return [
    { name: 'Created & Assessed', value: issues.filter(i => i.aiInvolvement === 'both').length },
    { name: 'AI Created', value: issues.filter(i => i.aiInvolvement === 'created').length },
    { name: 'AI Assessed', value: issues.filter(i => i.aiInvolvement === 'assessed').length },
    { name: 'No AI', value: issues.filter(i => i.aiInvolvement === 'none').length },
  ];
}

module.exports = { computeAllMetrics, computeMetrics, buildTrendData, buildBreakdownData, getTimeWindowDates };
