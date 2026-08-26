// Pure geometry helpers for the release timeline canvas rendering.
// Extracted so the stem/card hover math can be unit-tested without a canvas.

/**
 * Clamp a stem's highlight endpoints so the highlighted (on-top) stroke meets
 * the card's edge without piercing into its body.
 *
 * The base stem intentionally overshoots into the card by a few pixels so there
 * is no visible gap; that overshoot is normally hidden because the card fill is
 * painted after the stem. The hover highlight, however, is drawn *on top* of the
 * card, so it must stop at the card edge facing the axis.
 *
 * @param {{top:number, bottom:number}} stem  Stem line, pixel Y (top < bottom).
 * @param {{y:number, h:number}} card         Card rect, pixel coords.
 * @param {boolean} above                     True if the card sits above the axis.
 * @returns {{top:number, bottom:number}}     Clamped endpoints for the highlight.
 */
export function clampStemToCard(stem, card, above) {
  var top = stem.top
  var bottom = stem.bottom
  if (above) {
    // Card is above the axis; its bottom edge faces the stem.
    var cardBottom = card.y + card.h
    if (top < cardBottom) top = cardBottom
  } else {
    // Card is below the axis; its top edge faces the stem.
    var cardTop = card.y
    if (bottom > cardTop) bottom = cardTop
  }
  // Guard against an inverted/zero-length line if the card fully covers the stem.
  if (bottom < top) bottom = top
  return { top: top, bottom: bottom }
}
