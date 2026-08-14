/**
 * Client display helpers for TV/FV alignment categories.
 */
import { describe, it, expect } from 'vitest'
import {
  worseAlignmentCategory,
  isAlignedCategory,
  alignmentCategoryLabel,
  alignmentCategoryHelp,
  alignmentCategoryChipClass,
  ALIGNMENT_CATEGORY_LABELS,
  ALIGNMENT_CATEGORY_HELP
} from '../../../client/plan/utils/tv-fv-alignment-display.js'

describe('tv-fv-alignment-display', function() {
  it('picks worst category across merges', function() {
    expect(worseAlignmentCategory('aligned_on_time', 'misaligned')).toBe('misaligned')
    expect(worseAlignmentCategory('tv_only', 'aligned_late')).toBe('tv_only')
  })

  it('treats on-time and late as aligned (Not Aligned KPI excludes both)', function() {
    expect(isAlignedCategory('aligned_on_time')).toBe(true)
    expect(isAlignedCategory('aligned_late')).toBe(true)
    expect(isAlignedCategory('misaligned')).toBe(false)
    expect(isAlignedCategory('tv_only')).toBe(false)
    expect(isAlignedCategory('fv_only')).toBe(false)
  })

  it('labels match Delta language (On time, not Yes/No)', function() {
    expect(alignmentCategoryLabel('aligned_on_time')).toBe('On time')
    expect(alignmentCategoryLabel('aligned_late')).toBe('Late')
    expect(alignmentCategoryLabel('misaligned')).toBe('Misaligned')
    expect(alignmentCategoryLabel('tv_only')).toBe('TV only')
    expect(alignmentCategoryLabel('fv_only')).toBe('FV only')
    expect(Object.keys(ALIGNMENT_CATEGORY_LABELS).sort()).toEqual([
      'aligned_late',
      'aligned_on_time',
      'fv_only',
      'misaligned',
      'tv_only'
    ].sort())
  })

  it('help text is defined for every category', function() {
    Object.keys(ALIGNMENT_CATEGORY_HELP).forEach(function(cat) {
      expect(alignmentCategoryHelp(cat).length).toBeGreaterThan(10)
    })
    expect(alignmentCategoryHelp('aligned_on_time')).toMatch(/Fix Version matches Target Version|ships earlier/i)
  })

  it('chip classes are defined for all categories', function() {
    expect(alignmentCategoryChipClass('aligned_on_time')).toContain('emerald')
    expect(alignmentCategoryChipClass('aligned_late')).toContain('amber')
    expect(alignmentCategoryChipClass('misaligned')).toContain('red')
    expect(alignmentCategoryChipClass('tv_only')).toContain('blue')
    expect(alignmentCategoryChipClass('fv_only')).toContain('violet')
  })
})
