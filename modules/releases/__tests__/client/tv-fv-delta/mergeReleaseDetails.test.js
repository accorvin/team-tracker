/**
 * Unit tests for merging multi-product release detail buckets.
 */
import { describe, it, expect } from 'vitest'
import { mergeReleaseDetails } from '../../../client/composables/mergeReleaseDetails'

describe('mergeReleaseDetails', function () {
  it('returns null when no names or missing map', function () {
    expect(mergeReleaseDetails(null, ['a'])).toBeNull()
    expect(mergeReleaseDetails({}, [])).toBeNull()
    expect(mergeReleaseDetails({ a: { aligned: [] } }, ['missing'])).toBeNull()
  })

  it('merges categories across products and dedupes by key', function () {
    var releases = {
      '3.6 EA1 RHOAI RELEASE': {
        aligned: [{ key: 'RHAISTRAT-1', summary: 'A' }],
        tv_only: [{ key: 'RHAISTRAT-2', summary: 'B' }],
        fv_only: [],
        mismatched: [],
      },
      '3.6 EA1 RHAII RELEASE': {
        aligned: [{ key: 'RHAISTRAT-1', summary: 'A-dup' }, { key: 'RHAISTRAT-3', summary: 'C' }],
        tv_only: [],
        fv_only: [{ key: 'RHAISTRAT-4', summary: 'D' }],
        mismatched: [],
      },
    }

    var merged = mergeReleaseDetails(releases, [
      '3.6 EA1 RHOAI RELEASE',
      '3.6 EA1 RHAII RELEASE',
    ])

    expect(merged.aligned.map(function (f) { return f.key })).toEqual(['RHAISTRAT-1', 'RHAISTRAT-3'])
    expect(merged.tv_only.map(function (f) { return f.key })).toEqual(['RHAISTRAT-2'])
    expect(merged.fv_only.map(function (f) { return f.key })).toEqual(['RHAISTRAT-4'])
    expect(merged.mismatched).toEqual([])
  })

  it('skips names without detail data', function () {
    var merged = mergeReleaseDetails(
      { '3.6 EA1 RHOAI RELEASE': { aligned: [{ key: 'X' }], tv_only: [], fv_only: [], mismatched: [] } },
      ['3.6 EA1 RHOAI RELEASE', '3.6 EA1 RHELAI RELEASE'],
    )
    expect(merged.aligned).toHaveLength(1)
  })
})
