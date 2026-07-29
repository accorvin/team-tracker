import { describe, it, expect } from 'vitest'

const {
  sameReleaseCycle,
  tvSupportsCommittedFixVersion,
  filterCommittedFixVersions
} = require('../../../server/pm-hub/committed-definition')

describe('sameReleaseCycle', function () {
  it('true for same product + major.minor across naming styles', function () {
    expect(sameReleaseCycle('rhoai-3.6.EA1', '3.6 EA2 RHOAI RELEASE')).toBe(true)
    expect(sameReleaseCycle('rhoai-3.6.EA1', 'rhoai-3.6')).toBe(true)
  })

  it('false for different minor, product, or unparseable', function () {
    expect(sameReleaseCycle('rhoai-3.6.EA1', 'rhoai-3.5.EA1')).toBe(false)
    expect(sameReleaseCycle('rhoai-3.6.EA1', 'rhelai-3.6.EA1')).toBe(false)
    expect(sameReleaseCycle('rhoai-3.6.EA1', 'not-a-version')).toBe(false)
  })
})

describe('tvSupportsCommittedFixVersion / filterCommittedFixVersions', function () {
  it('exact TV=FV match → committed', function () {
    expect(tvSupportsCommittedFixVersion('rhoai-3.6.EA1', ['rhoai-3.6.EA1'])).toBe(true)
    expect(filterCommittedFixVersions(['rhoai-3.6.EA1'], ['rhoai-3.6.EA1'])).toEqual(['rhoai-3.6.EA1'])
  })

  it('semantic TV=FV match across naming styles → committed', function () {
    expect(
      tvSupportsCommittedFixVersion('rhoai-3.6.EA1', ['3.6 EA1 RHOAI RELEASE'])
    ).toBe(true)
  })

  it('early delivery (FV EA1, TV EA2 same cycle) → committed', function () {
    expect(
      tvSupportsCommittedFixVersion('rhoai-3.6.EA1', ['rhoai-3.6.EA2'])
    ).toBe(true)
    expect(
      tvSupportsCommittedFixVersion('rhoai-3.6.EA1', ['3.6 EA2 RHOAI RELEASE'])
    ).toBe(true)
    expect(
      tvSupportsCommittedFixVersion('rhoai-3.6.EA2', ['rhoai-3.6'])
    ).toBe(true)
  })

  it('FV-only (no TV) → not committed', function () {
    expect(tvSupportsCommittedFixVersion('rhoai-3.6.EA1', [])).toBe(false)
    expect(tvSupportsCommittedFixVersion('rhoai-3.6.EA1', null)).toBe(false)
    expect(filterCommittedFixVersions(['rhoai-3.6.EA1'], [])).toEqual([])
  })

  it('late (FV EA2, TV EA1 same cycle) → not committed', function () {
    expect(
      tvSupportsCommittedFixVersion('rhoai-3.6.EA2', ['rhoai-3.6.EA1'])
    ).toBe(false)
    expect(
      tvSupportsCommittedFixVersion('rhoai-3.6', ['rhoai-3.6.EA1'])
    ).toBe(false)
  })

  it('cross-cycle / cross-product → not committed', function () {
    expect(
      tvSupportsCommittedFixVersion('rhoai-3.6.EA1', ['rhoai-3.5.EA2'])
    ).toBe(false)
    expect(
      tvSupportsCommittedFixVersion('rhoai-3.6.EA1', ['rhelai-3.6.EA2'])
    ).toBe(false)
  })

  it('unparseable TV that cannot establish same-cycle → not committed', function () {
    expect(
      tvSupportsCommittedFixVersion('rhoai-3.6.EA1', ['Totally Unknown Version'])
    ).toBe(false)
  })

  it('identical unparseable TV and FV strings → committed (exact match)', function () {
    expect(
      tvSupportsCommittedFixVersion('Custom Label X', ['Custom Label X'])
    ).toBe(true)
  })

  it('filters matching FVs to only those supported by TV', function () {
    var matchingFv = ['rhoai-3.6.EA1', 'rhoai-3.6.EA2']
    // TV EA1 supports EA1 match, but not EA2 (late)
    expect(filterCommittedFixVersions(matchingFv, ['rhoai-3.6.EA1'])).toEqual([
      'rhoai-3.6.EA1'
    ])
    // TV EA2 supports EA1 (early) and EA2 (match)
    expect(filterCommittedFixVersions(matchingFv, ['rhoai-3.6.EA2'])).toEqual([
      'rhoai-3.6.EA1',
      'rhoai-3.6.EA2'
    ])
  })
})

describe('Requested unchanged (caller contract)', function () {
  // Requested is TV ∩ selected scope — not altered by committed helpers.
  // Document the independence: FV-only helpers never consume matchingTv.
  it('committed helpers ignore selected-scope TV list; use all issue TVs', function () {
    // Selected scope is EA1 only; TV is EA2 (not in scope) but still qualifies early delivery
    var matchingFv = ['rhoai-3.6.EA1']
    var allTvOnIssue = ['rhoai-3.6.EA2']
    expect(filterCommittedFixVersions(matchingFv, allTvOnIssue)).toEqual([
      'rhoai-3.6.EA1'
    ])
  })

  it('TV-only (no matching FV) yields empty committed list', function () {
    expect(filterCommittedFixVersions([], ['rhoai-3.6.EA1'])).toEqual([])
  })
})
