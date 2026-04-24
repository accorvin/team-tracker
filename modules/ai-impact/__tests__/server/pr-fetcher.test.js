import { describe, it, expect } from 'vitest';
import { buildChunks, reclassifyBotFields, sizeBucket } from '../../server/github/pr-fetcher.js';

describe('buildChunks', () => {
  it('splits a 90-day range into 3 chunks of 30 days', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-04-01');
    const chunks = buildChunks(from, to, 30);
    expect(chunks.length).toBe(3);
    expect(chunks[0].start.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(chunks[0].end.toISOString().slice(0, 10)).toBe('2026-01-31');
    expect(chunks[2].end.toISOString().slice(0, 10)).toBe('2026-04-01');
  });

  it('handles a range shorter than maxDays as a single chunk', () => {
    const from = new Date('2026-04-01');
    const to = new Date('2026-04-10');
    const chunks = buildChunks(from, to, 30);
    expect(chunks.length).toBe(1);
    expect(chunks[0].start.toISOString().slice(0, 10)).toBe('2026-04-01');
    expect(chunks[0].end.toISOString().slice(0, 10)).toBe('2026-04-10');
  });

  it('returns empty array when from equals to', () => {
    const date = new Date('2026-04-01');
    const chunks = buildChunks(date, date, 30);
    expect(chunks.length).toBe(0);
  });

  it('handles uneven day count with a shorter final chunk', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-02-15');
    const chunks = buildChunks(from, to, 30);
    expect(chunks.length).toBe(2);
    expect(chunks[1].end.toISOString().slice(0, 10)).toBe('2026-02-15');
  });
});

describe('sizeBucket', () => {
  it('classifies by total lines changed', () => {
    expect(sizeBucket(10, 5)).toBe('XS');
    expect(sizeBucket(100, 50)).toBe('S');
    expect(sizeBucket(500, 200)).toBe('M');
    expect(sizeBucket(1500, 500)).toBe('L');
    expect(sizeBucket(2000, 1000)).toBe('XL');
  });

  it('handles null/undefined inputs', () => {
    expect(sizeBucket(null, null)).toBe('XS');
    expect(sizeBucket(undefined, undefined)).toBe('XS');
  });
});

describe('reclassifyBotFields', () => {
  const basePR = {
    author: 'alice',
    _reviews: [
      { author: 'alice', state: 'APPROVED', submittedAt: '2026-04-01T00:00:00Z', commentCount: 1 },
      { author: 'coderabbitai[bot]', state: 'COMMENTED', submittedAt: '2026-04-01T01:00:00Z', commentCount: 5 },
      { author: 'bob', state: 'CHANGES_REQUESTED', submittedAt: '2026-04-01T02:00:00Z', commentCount: 2 }
    ],
    _threads: [
      { firstCommentAuthor: 'coderabbitai[bot]', isResolved: true },
      { firstCommentAuthor: 'coderabbitai[bot]', isResolved: false },
      { firstCommentAuthor: 'bob', isResolved: true }
    ]
  };

  it('classifies bot-authored PRs correctly', () => {
    const botPR = { ...basePR, author: 'coderabbitai[bot]' };
    const result = reclassifyBotFields([botPR], ['coderabbitai[bot]']);
    expect(result[0].authorIsBot).toBe(true);
  });

  it('classifies human-authored PRs correctly', () => {
    const result = reclassifyBotFields([basePR], ['coderabbitai[bot]']);
    expect(result[0].authorIsBot).toBe(false);
  });

  it('computes aiReviewed from bot reviews', () => {
    const result = reclassifyBotFields([basePR], ['coderabbitai[bot]']);
    expect(result[0].aiReviewed).toBe(true);
  });

  it('computes humanReviewComments and botReviewComments', () => {
    const result = reclassifyBotFields([basePR], ['coderabbitai[bot]']);
    expect(result[0].humanReviewComments).toBe(3); // alice:1 + bob:2
    expect(result[0].botReviewComments).toBe(5);
  });

  it('computes reviewIterations from human CHANGES_REQUESTED', () => {
    const result = reclassifyBotFields([basePR], ['coderabbitai[bot]']);
    expect(result[0].reviewIterations).toBe(1);
  });

  it('computes aiThreads from thread first-comment authors', () => {
    const result = reclassifyBotFields([basePR], ['coderabbitai[bot]']);
    expect(result[0].aiThreads.total).toBe(2);
    expect(result[0].aiThreads.resolved).toBe(1);
  });

  it('reclassifies when bot list changes', () => {
    const noBot = reclassifyBotFields([basePR], []);
    expect(noBot[0].aiReviewed).toBe(false);
    expect(noBot[0].botReviewComments).toBe(0);
    expect(noBot[0].humanReviewComments).toBe(8); // all reviews are human
    expect(noBot[0].aiThreads.total).toBe(0);

    const withBob = reclassifyBotFields([basePR], ['bob']);
    expect(withBob[0].botReviewComments).toBe(2);
    expect(withBob[0].humanReviewComments).toBe(6); // alice:1 + coderabbit:5
    expect(withBob[0].aiThreads.total).toBe(1); // bob's thread
  });

  it('handles PRs without _reviews/_threads (pre-migration)', () => {
    const oldPR = { author: 'alice', aiReviewed: true };
    const result = reclassifyBotFields([oldPR], ['coderabbitai[bot]']);
    expect(result[0].aiReviewed).toBe(true); // unchanged
    expect(result[0]).toBe(oldPR); // same reference, not modified
  });

  it('is case-insensitive for bot username matching', () => {
    const result = reclassifyBotFields([basePR], ['CodeRabbitAI[bot]']);
    expect(result[0].aiReviewed).toBe(true);
    expect(result[0].botReviewComments).toBe(5);
  });
});
