/**
 * Client display helpers for TV/FV alignment categories.
 */
import { describe, it, expect } from 'vitest'
import {
  worseAlignmentCategory,
  isAlignedCategory,
  alignmentCategoryLabel,
  alignmentCategoryChipClass
} from '../../../client/plan/utils/tv-fv-alignment-display.js'

describe('tv-fv-alignment-display', function() {
  it('picks worst category across merges', function() {
    expect(worseAlignmentCategory('aligned_on_time', 'misaligned')).toBe('misaligned')
    expect(worseAlignmentCategory('tv_only', 'aligned_late')).toBe('tv_only')
  })

  it('treats on-time and late as aligned', function() {
    expect(isAlignedCategory('aligned_on_time')).toBe(true)
    expect(isAlignedCategory('aligned_late')).toBe(true)
    expect(isAlignedCategory('misaligned')).toBe(false)
  })

  it('labels and chip classes are defined for all categories', function() {
    expect(alignmentCategoryLabel('fv_only')).toBe('FV only')
    expect(alignmentCategoryChipClass('aligned_on_time')).toContain('emerald')
    expect(alignmentCategoryChipClass('misaligned')).toContain('red')
  })
})
