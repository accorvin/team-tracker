/**
 * Unit tests for merging multi-product release detail buckets.
 */
import { describe, it, expect } from 'vitest'
import { mergeReleaseDetails } from '../../../client/composables/mergeReleaseDetails'

describe('mergeReleaseDetails', function () {
  it('returns null when no names or missing map', function () {
    expect(mergeReleaseDetails(null, ['a'])).toBeNull()
    expect(mergeReleaseDetails({}, [])).toBeNull()
    expect(mergeReleaseDetails({ a: { aligned_on_time: [] } }, ['missing'])).toBeNull()
  })

  it('merges categories across products and dedupes by key', function () {
    var releases = {
      '3.6 EA1 RHOAI RELEASE': {
        aligned_on_time: [{ key: 'RHAISTRAT-1', summary: 'A' }],
        aligned_late: [],
        tv_only: [{ key: 'RHAISTRAT-2', summary: 'B' }],
        fv_only: [],
        misaligned: [],
      },
      '3.6 EA1 RHAII RELEASE': {
        aligned_on_time: [{ key: 'RHAISTRAT-1', summary: 'A-dup' }, { key: 'RHAISTRAT-3', summary: 'C' }],
        aligned_late: [{ key: 'RHAISTRAT-5', summary: 'E' }],
        tv_only: [],
        fv_only: [{ key: 'RHAISTRAT-4', summary: 'D' }],
        misaligned: [],
      },
    }

    var merged = mergeReleaseDetails(releases, [
      '3.6 EA1 RHOAI RELEASE',
      '3.6 EA1 RHAII RELEASE',
    ])

    expect(merged.aligned_on_time.map(function (f) { return f.key })).toEqual(['RHAISTRAT-1', 'RHAISTRAT-3'])
    expect(merged.aligned_late.map(function (f) { return f.key })).toEqual(['RHAISTRAT-5'])
    expect(merged.tv_only.map(function (f) { return f.key })).toEqual(['RHAISTRAT-2'])
    expect(merged.fv_only.map(function (f) { return f.key })).toEqual(['RHAISTRAT-4'])
    expect(merged.misaligned).toEqual([])
  })

  it('skips names without detail data', function () {
    var merged = mergeReleaseDetails(
      {
        '3.6 EA1 RHOAI RELEASE': {
          aligned_on_time: [{ key: 'X' }],
          aligned_late: [],
          tv_only: [],
          fv_only: [],
          misaligned: [],
        },
      },
      ['3.6 EA1 RHOAI RELEASE', '3.6 EA1 RHELAI RELEASE'],
    )
    expect(merged.aligned_on_time).toHaveLength(1)
  })
})
