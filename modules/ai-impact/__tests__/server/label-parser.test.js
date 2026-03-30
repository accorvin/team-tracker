import { describe, it, expect } from 'vitest';
import { classifyAIInvolvement } from '../../server/jira/label-parser.js';

const CREATED_PREFIX = 'rfe-creator-';
const ASSESSED_PREFIX = 'rfe-assess-';
const TEST_LABEL = 'rfe-creator-skill-testing';

describe('classifyAIInvolvement', () => {
  it('returns "created" for rfe-creator-v2 only', () => {
    expect(classifyAIInvolvement(['rfe-creator-v2'], CREATED_PREFIX, ASSESSED_PREFIX, TEST_LABEL)).toBe('created');
  });

  it('returns "assessed" for rfe-assess-v1 only', () => {
    expect(classifyAIInvolvement(['rfe-assess-v1'], CREATED_PREFIX, ASSESSED_PREFIX, TEST_LABEL)).toBe('assessed');
  });

  it('returns "both" when both prefixes are present', () => {
    expect(classifyAIInvolvement(['rfe-creator-v2', 'rfe-assess-v1'], CREATED_PREFIX, ASSESSED_PREFIX, TEST_LABEL)).toBe('both');
  });

  it('returns "none" when neither prefix is present', () => {
    expect(classifyAIInvolvement(['customer-request', 'strategic'], CREATED_PREFIX, ASSESSED_PREFIX, TEST_LABEL)).toBe('none');
  });

  it('returns "none" for empty labels', () => {
    expect(classifyAIInvolvement([], CREATED_PREFIX, ASSESSED_PREFIX, TEST_LABEL)).toBe('none');
  });

  it('returns "none" when only the test exclusion label is present', () => {
    expect(classifyAIInvolvement(['rfe-creator-skill-testing'], CREATED_PREFIX, ASSESSED_PREFIX, TEST_LABEL)).toBe('none');
  });

  it('works with custom prefixes', () => {
    expect(classifyAIInvolvement(['custom-created-v1'], 'custom-created-', 'custom-assessed-', 'custom-created-test')).toBe('created');
    expect(classifyAIInvolvement(['custom-assessed-v1'], 'custom-created-', 'custom-assessed-', 'custom-created-test')).toBe('assessed');
    expect(classifyAIInvolvement(['custom-created-v1', 'custom-assessed-v1'], 'custom-created-', 'custom-assessed-', 'custom-created-test')).toBe('both');
  });

  it('ignores non-matching labels alongside matching ones', () => {
    expect(classifyAIInvolvement(['rfe-creator-v2', 'unrelated-label'], CREATED_PREFIX, ASSESSED_PREFIX, TEST_LABEL)).toBe('created');
  });
});
