/**
 * Unit tests for shared TV/FV alignment helpers used by PM Hub.
 */
import { describe, it, expect } from 'vitest'

const {
  classifyForRelease,
  isAlignedCategory,
  categoryLabel,
  worstCategory
} = require('../../../server/tv-fv-delta/alignment')

describe('tv-fv-delta/alignment (PM Hub shared)', function() {
  it('classifies exact TV/FV match as aligned_on_time', function() {
    var cat = classifyForRelease(['rhoai-3.6'], ['rhoai-3.6'], 'rhoai-3.6', {})
    expect(cat).toBe('aligned_on_time')
    expect(isAlignedCategory(cat)).toBe(true)
  })

  it('classifies early delivery (FV before TV) as aligned_on_time for the TV release', function() {
    var cat = classifyForRelease(['rhoai-3.6'], ['rhoai-3.5'], 'rhoai-3.6', {})
    expect(cat).toBe('aligned_on_time')
    expect(isAlignedCategory(cat)).toBe(true)
  })

  it('classifies TV-only as tv_only', function() {
    var cat = classifyForRelease(['rhoai-3.6'], [], 'rhoai-3.6', {})
    expect(cat).toBe('tv_only')
    expect(isAlignedCategory(cat)).toBe(false)
  })

  it('classifies FV-only as fv_only', function() {
    var cat = classifyForRelease([], ['rhoai-3.6'], 'rhoai-3.6', {})
    expect(cat).toBe('fv_only')
    expect(isAlignedCategory(cat)).toBe(false)
  })

  it('classifies unfrozen slip as misaligned', function() {
    var cat = classifyForRelease(['rhoai-3.5'], ['rhoai-3.6'], 'rhoai-3.5', {})
    expect(cat).toBe('misaligned')
  })

  it('classifies frozen slip as aligned_late', function() {
    var releaseDates = {
      'rhoai 3 5': { planningFreezeDate: '2020-01-01', dueDate: '2020-02-01' }
    }
    var cat = classifyForRelease(['rhoai-3.5'], ['rhoai-3.6'], 'rhoai-3.5', releaseDates)
    expect(cat).toBe('aligned_late')
    expect(isAlignedCategory(cat)).toBe(true)
  })

  it('returns null when release is not on TV or FV', function() {
    expect(classifyForRelease(['rhoai-3.5'], ['rhoai-3.5'], 'rhoai-3.6', {})).toBeNull()
  })

  it('labels and worstCategory helpers work', function() {
    expect(categoryLabel('aligned_on_time')).toBe('On time')
    expect(worstCategory(['aligned_on_time', 'misaligned', 'tv_only'])).toBe('misaligned')
  })
})
