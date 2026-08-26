import { describe, it, expect } from 'vitest'
import { clampStemToCard } from '../timeline-geometry.js'

// Mirrors the pixel geometry used in ReleaseTimeline.vue:
//   above node: stem top = yMid - stemLen - 8, card bottom = yMid - stemLen - 4
//   below node: stem bottom = yMid + stemLen + 8, card top = yMid + stemLen + 4
// The base stem overshoots the card by 4px on the card-facing side.

describe('clampStemToCard', function () {
  describe('above the axis (card sits above, stem goes down to the axis)', function () {
    // yMid=300, stemLen=64 → stem top=228, bottom=294; card bottom edge=232
    var card = { y: 172, h: 60 } // card bottom = 232
    var stem = { top: 228, bottom: 294 }

    it('pulls the stem top down to the card bottom edge so it does not pierce', function () {
      var ends = clampStemToCard(stem, card, true)
      expect(ends.top).toBe(232) // card.y + card.h
      expect(ends.bottom).toBe(294) // axis-side end untouched
    })

    it('never renders above (into) the card body', function () {
      var ends = clampStemToCard(stem, card, true)
      expect(ends.top).toBeGreaterThanOrEqual(card.y + card.h)
    })

    it('leaves an already-flush stem unchanged', function () {
      var flush = { top: 232, bottom: 294 }
      var ends = clampStemToCard(flush, card, true)
      expect(ends.top).toBe(232)
      expect(ends.bottom).toBe(294)
    })
  })

  describe('below the axis (card sits below, stem goes up to the axis)', function () {
    // yMid=300, stemLen=64 → stem top=306, bottom=372; card top edge=368
    var card = { y: 368, h: 60 }
    var stem = { top: 306, bottom: 372 }

    it('pulls the stem bottom up to the card top edge so it does not pierce', function () {
      var ends = clampStemToCard(stem, card, false)
      expect(ends.bottom).toBe(368) // card.y
      expect(ends.top).toBe(306) // axis-side end untouched
    })

    it('never renders below (into) the card body', function () {
      var ends = clampStemToCard(stem, card, false)
      expect(ends.bottom).toBeLessThanOrEqual(card.y)
    })
  })

  it('never produces an inverted line when the card fully covers the stem', function () {
    // Degenerate: card overlaps entire stem span.
    var card = { y: 100, h: 400 }
    var stem = { top: 228, bottom: 294 }
    var above = clampStemToCard(stem, card, true)
    expect(above.bottom).toBeGreaterThanOrEqual(above.top)
    var below = clampStemToCard(stem, card, false)
    expect(below.bottom).toBeGreaterThanOrEqual(below.top)
  })
})
