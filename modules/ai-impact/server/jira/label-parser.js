function classifyAIInvolvement(labels, createdPrefix, assessedPrefix, testLabel) {
  const isTest = labels.includes(testLabel);
  if (isTest) return 'none'; // safety net (also excluded in JQL)

  const hasCreated = labels.some(l => l.startsWith(createdPrefix) && l !== testLabel);
  const hasAssessed = labels.some(l => l.startsWith(assessedPrefix));

  if (hasCreated && hasAssessed) return 'both';
  if (hasCreated) return 'created';
  if (hasAssessed) return 'assessed';
  return 'none';
}

module.exports = { classifyAIInvolvement };
