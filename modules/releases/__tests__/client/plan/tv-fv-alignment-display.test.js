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
  alignmentLegendEntries,
  buildAlignmentDetail,
  ALIGNMENT_CATEGORY_LABELS,
  ALIGNMENT_CATEGORY_HELP,
  ALIGNMENT_LEGEND_NOTES
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
    expect(alignmentCategoryHelp('aligned_on_time')).toMatch(/same milestone|earlier/i)
    expect(alignmentCategoryHelp('aligned_late')).toMatch(/later milestone|Accepted slip/i)
  })

  it('legend entries cover all five categories plus unique-key notes', function() {
    var entries = alignmentLegendEntries()
    expect(entries.map(function(e) { return e.key })).toEqual([
      'aligned_on_time',
      'aligned_late',
      'tv_only',
      'fv_only',
      'misaligned'
    ])
    entries.forEach(function(entry) {
      expect(entry.label).toBeTruthy()
      expect(entry.help.length).toBeGreaterThan(10)
      expect(entry.chipClass).toBeTruthy()
    })
    expect(ALIGNMENT_LEGEND_NOTES.length).toBe(3)
    expect(ALIGNMENT_LEGEND_NOTES[2]).toMatch(/Hub tiles count each issue once/i)
  })

  it('chip classes are defined for all categories', function() {
    expect(alignmentCategoryChipClass('aligned_on_time')).toContain('emerald')
    expect(alignmentCategoryChipClass('aligned_late')).toContain('amber')
    expect(alignmentCategoryChipClass('misaligned')).toContain('red')
    expect(alignmentCategoryChipClass('tv_only')).toContain('blue')
    expect(alignmentCategoryChipClass('fv_only')).toContain('violet')
  })

  it('summarizes requested EA1 vs committed EA2', function() {
    var detail = buildAlignmentDetail({
      alignmentCategory: 'aligned_late',
      targetVersions: ['3.6 EA1 RHOAI RELEASE'],
      fixVersions: ['3.6 EA2 RHOAI RELEASE']
    })
    expect(detail.summary).toBe('Requested for EA1, committed for EA2.')
    expect(detail.categoryLabel).toBe('Late')
  })

  it('summarizes matching requested and committed milestones', function() {
    var detail = buildAlignmentDetail({
      alignmentCategory: 'aligned_on_time',
      targetVersions: ['3.6 EA2 RHOAI RELEASE'],
      fixVersions: ['3.6 EA2 RHOAI RELEASE']
    })
    expect(detail.summary).toBe('Requested and committed for EA2.')
  })

  it('summarizes Target Version only', function() {
    var detail = buildAlignmentDetail({
      alignmentCategory: 'tv_only',
      targetVersions: ['3.6 EA2 RHOAI RELEASE'],
      fixVersions: []
    })
    expect(detail.summary).toBe('Requested for EA2, not committed.')
  })

  it('summarizes Fix Version only', function() {
    var detail = buildAlignmentDetail({
      alignmentCategory: 'fv_only',
      targetVersions: [],
      fixVersions: ['3.6 EA2 RHOAI RELEASE']
    })
    expect(detail.summary).toBe('Committed for EA2, no Target Version.')
  })

  it('includes product names when TV and FV point at different products', function() {
    var detail = buildAlignmentDetail({
      alignmentCategory: 'misaligned',
      targetVersions: ['3.6 EA1 RHOAI RELEASE'],
      fixVersions: ['3.6 EA1 RHAII RELEASE']
    })
    expect(detail.summary).toBe('Requested for RHOAI EA1, committed for RHAII EA1.')
  })

  it('parses compact release names the same way as Jira names', function() {
    var detail = buildAlignmentDetail({
      alignmentCategory: 'aligned_late',
      targetVersions: ['rhoai-3.6.EA1'],
      fixVersions: ['rhoai-3.6.EA2']
    })
    expect(detail.summary).toBe('Requested for EA1, committed for EA2.')
  })

  it('falls back to fixVersion when fixVersions is empty', function() {
    var detail = buildAlignmentDetail({
      alignmentCategory: 'fv_only',
      targetVersions: [],
      fixVersion: '3.6 EA2 RHOAI RELEASE'
    })
    expect(detail.summary).toBe('Committed for EA2, no Target Version.')
  })
})
