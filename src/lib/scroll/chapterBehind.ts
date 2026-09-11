import { cachedElement } from '@/lib/dom/cachedElement';

/* ============================================================================
   What is actually behind a fixed element, right now.

   The navigation bar and the footer both sit over whatever the page happens to
   be showing, and both have to switch to light ink the moment the chapter's
   green arrives underneath them. They used to decide that from a threshold --
   the footer at `seq >= 0.78`, the bar when `data-bg-transition` landed at 95%
   -- and a threshold is a statement about the reader's scroll position, not
   about what is on screen.

   Those are very different things here, because the green does not arrive
   everywhere at once. It climbs from the bottom over a second and a half. The
   footer sits sixty pixels off the bottom edge, so the wall reaches it almost
   immediately; the bar sits at the top, so the wall reaches it last. Deciding
   both from one number meant both were wrong, in opposite directions: the
   footer went light a beat before the green got to it, and the bar stayed dark
   over green for most of the climb.

   This asks the wall instead. The grid publishes which of its cells are lit, so
   the honest question -- "is the chapter colour behind THIS strip of the screen
   yet" -- is answerable exactly, per row, on any frame.
   ========================================================================== */

const findGrid = cachedElement(() =>
  typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLElement>('[data-testid="bg-pixel-transition-grid"]')
);

const findBackdrop = cachedElement(() =>
  typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLElement>('[data-testid="bg-pixel-transition-backdrop"]')
);

/**
 * Whether the chapter colour has reached the strip of screen at `viewportY`.
 *
 * Reads the cells directly rather than recomputing their thresholds. They are
 * the same cells the reader is looking at, so there is no way for this to
 * disagree with what is on screen -- which is the entire point, and something a
 * parallel calculation could not promise.
 *
 * Costs one row of `dataset` reads, no geometry: the grid fills the overlay and
 * the overlay fills the viewport, so a row is found by arithmetic. That matters
 * because both callers run from inside the render loop.
 */
export function isChapterBehind(viewportY: number): boolean {
  if (typeof window === 'undefined') return false;

  /*
   * Once the solid backdrop is up the grid no longer describes the screen --
   * everything behind it is the chapter colour whether or not a given cell is
   * still flagged.
   */
  const backdrop = findBackdrop();
  if (backdrop?.dataset.active === 'true') return true;

  const grid = findGrid();
  if (!grid) return false;

  const cells = grid.children;
  const total = cells.length;
  if (total === 0) return false;

  const cols = Number.parseInt(
    getComputedStyle(grid).getPropertyValue('--bg-cols'),
    10
  );
  if (!Number.isFinite(cols) || cols <= 0) return false;

  const rows = Math.round(total / cols);
  if (rows <= 0) return false;

  const rowHeight = window.innerHeight / rows;
  if (!(rowHeight > 0)) return false;

  const row = Math.min(
    rows - 1,
    Math.max(0, Math.floor(viewportY / rowHeight))
  );

  /*
   * A majority of the row, not any cell of it.
   *
   * The edge is deliberately ragged -- cells in a row light a couple of rows
   * deep apart -- so "one cell is lit" flips the ink while most of the strip is
   * still the old ground, and "every cell is lit" leaves it flipping late. The
   * midpoint is the moment the strip reads as the new colour.
   */
  let lit = 0;
  for (let col = 0; col < cols; col++) {
    const cell = cells[row * cols + col] as HTMLElement | undefined;
    if (cell?.dataset.active === 'true') lit += 1;
  }
  return lit * 2 > cols;
}
