/* ============================================================================
   Where a heading's first letter actually starts painting.

   A display heading is aligned by the edge of its first letter, not by the
   edge of its text box, and the two are not the same place: every glyph
   carries a left side bearing, a sliver of air built into the font between
   the origin the browser lays text from and the first ink.

   This has to be measured on the reader's own machine rather than written
   down. The stylesheet asks for Inter but nothing in the app ever loads it,
   so the face that renders is whatever the visitor happens to have: Inter
   where it is installed, and the platform fallback everywhere else. Those
   disagree -- Inter's `A` at weight 800 begins exactly on the origin, and the
   Windows fallback at the same weight begins well inside it. A number baked
   in here would be right for whoever it was measured on and wrong for
   everyone else.
   ========================================================================== */

/**
 * Distance from the text origin to the left edge of the first glyph's ink.
 *
 * Positive when the ink starts inside the box, which is the ordinary case.
 * Zero whenever it cannot be measured -- no canvas, no text metrics, an
 * engine without `actualBoundingBoxLeft` -- so the caller falls back to
 * aligning on the text box, which is where it aligned before any of this.
 */
export function firstGlyphInkOffset(text: string, font: string): number {
  const first = text.trim().charAt(0);
  if (!first || !font) return 0;
  if (typeof document === 'undefined') return 0;

  try {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return 0;

    context.font = font;

    /*
     * Checked by size, not by string equality.
     *
     * A canvas normalises what it is given -- it drops an explicit `normal`
     * style, reorders, requotes -- so the value read back is almost never the
     * value written, and comparing them exactly rejects every font there is.
     * What matters is that the declaration was accepted at all rather than
     * left at the default `10px sans-serif`, and the size surviving is the
     * cheap way to know: it is the one part that cannot be normalised away.
     *
     * The family list is deliberately not checked. Canvas resolves it the same
     * way the element does, so measuring the list gives whichever face is
     * actually rendering -- which, for a stylesheet naming a font nothing
     * loads, is the whole point.
     */
    const size = /(\d*\.?\d+)px/.exec(font)?.[1];
    if (!size || !context.font.includes(`${size}px`)) return 0;

    const metrics = context.measureText(first);
    const left = metrics.actualBoundingBoxLeft;
    if (typeof left !== 'number' || !Number.isFinite(left)) return 0;

    /*
     * The metric is measured leftwards from the origin, so ink that starts
     * inside the box reports as negative. Only that case is a bearing; a
     * glyph that overhangs to the left of the origin is left alone, because
     * pushing the mark further left to chase it would put it in the margin.
     */
    const bearing = -left;
    if (!(bearing > 0)) return 0;

    /*
     * Guarded against a nonsense reading. A bearing is a small fraction of the
     * em, and anything approaching the width of the letter means the metric
     * was not what this assumed -- better the old box alignment than a mark
     * flung into the middle of the word.
     */
    const advance = metrics.width;
    if (Number.isFinite(advance) && advance > 0 && bearing > advance / 2) {
      return 0;
    }

    return bearing;
  } catch {
    return 0;
  }
}

/** The canvas font shorthand for an element, as it is actually rendering. */
export function fontShorthand(style: CSSStyleDeclaration): string {
  const { fontStyle, fontWeight, fontSize, fontFamily } = style;
  if (!fontSize || !fontFamily) return '';
  return `${fontStyle || 'normal'} ${fontWeight || '400'} ${fontSize} ${fontFamily}`;
}
