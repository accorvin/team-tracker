/**
 * Compute adoption metrics for a given time window.
 *
 * @param {Array} issues - Cached RFE issue list
 * @param {string} timeWindow - 'week' | 'month' | '3months'
 * @param {object} config - Module config (for trendThresholdPp)
 * @returns {{ metrics, trendData, breakdown }}
 */
function getRelevantDate(issue) {
  const dates = [issue.created];
  if (issue.createdLabelDate) dates.push(issue.createdLabelDate);
  if (issue.revisedLabelDate) dates.push(issue.revisedLabelDate);
  return dates.reduce((latest, d) =>
    new Date(d) > new Date(latest) ? d : latest
  );
}

function computeAllMetrics(issues, timeWindow, config) {
  const { cutoff } = getTimeWindowDates(new Date(), timeWindow);
  const windowIssues = issues.filter(i => new Date(getRelevantDate(i)) >= cutoff);
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

  const currentIssues = issues.filter(i => new Date(getRelevantDate(i)) >= cutoff);
  const priorIssues = issues.filter(i => {
    const d = new Date(getRelevantDate(i));
    return d >= priorCutoff && d < cutoff;
  });

  const currentCreated = currentIssues.filter(i =>
    i.aiInvolvement === 'created' || i.aiInvolvement === 'both').length;
  const currentRevised = currentIssues.filter(i =>
    i.aiInvolvement === 'revised' || i.aiInvolvement === 'both').length;
  const currentTotal = currentIssues.length;

  const priorCreated = priorIssues.filter(i =>
    i.aiInvolvement === 'created' || i.aiInvolvement === 'both').length;
  const priorRevised = priorIssues.filter(i =>
    i.aiInvolvement === 'revised' || i.aiInvolvement === 'both').length;
  const priorTotal = priorIssues.length;

  const createdPct = currentTotal > 0 ? Math.round((currentCreated / currentTotal) * 100) : 0;
  const revisedPct = currentTotal > 0 ? Math.round((currentRevised / currentTotal) * 100) : 0;
  const priorCreatedPct = priorTotal > 0 ? Math.round((priorCreated / priorTotal) * 100) : 0;
  const priorRevisedPct = priorTotal > 0 ? Math.round((priorRevised / priorTotal) * 100) : 0;

  const createdChange = createdPct - priorCreatedPct;
  const revisedChange = revisedPct - priorRevisedPct;
  const trend = createdChange > threshold ? 'growing' : createdChange < -threshold ? 'declining' : 'stable';
  const revisedTrend = revisedChange > threshold ? 'growing' : revisedChange < -threshold ? 'declining' : 'stable';

  return {
    createdPct, revisedPct, createdChange, revisedChange, trend, revisedTrend,
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
      const d = new Date(getRelevantDate(i));
      return d >= weekStart && d < weekEnd;
    });
    const total = weekIssues.length;
    const createdWithAI = weekIssues.filter(i =>
      i.aiInvolvement === 'created' || i.aiInvolvement === 'both').length;
    const revisedWithAI = weekIssues.filter(i =>
      i.aiInvolvement === 'revised' || i.aiInvolvement === 'both').length;

    points.push({
      date: weekEnd.toISOString().slice(0, 10),
      createdPct: total > 0 ? Math.round((createdWithAI / total) * 100) : 0,
      revisedPct: total > 0 ? Math.round((revisedWithAI / total) * 100) : 0,
      total
    });
  }

  return points;
}

function buildBreakdownData(issues) {
  return [
    { name: 'Created & Revised', value: issues.filter(i => i.aiInvolvement === 'both').length },
    { name: 'AI Created', value: issues.filter(i => i.aiInvolvement === 'created').length },
    { name: 'AI Revised', value: issues.filter(i => i.aiInvolvement === 'revised').length },
    { name: 'No AI', value: issues.filter(i => i.aiInvolvement === 'none').length },
  ];
}

module.exports = { computeAllMetrics, computeMetrics, buildTrendData, buildBreakdownData, getTimeWindowDates, getRelevantDate };
