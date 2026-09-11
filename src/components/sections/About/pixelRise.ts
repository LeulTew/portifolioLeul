/* ============================================================================
   The geometry of the background rise.

   Modelled on the `section-scroll-transition-pixels` grid on runrobrun.com,
   which is what this effect was after in the first place. Measured off the live
   site at a 1345x1270 viewport:

     - 10 columns of SQUARE cells, 134.5px a side. Square is the character of
       it: these read as pixels, and a pixel is not a letterbox.
     - `transition: opacity 0.02s linear` per cell. Effectively a hard pop --
       all of the softness is in the spread of the thresholds, none of it is in
       the cell.
     - Per-cell delays from 0.041s to 0.439s. Row means step evenly by ~0.035s
       while each row spreads ~0.08s, so a row's own scatter runs a little over
       two rows deep and the edge never resolves into a straight horizontal.
     - Column means are flat across the grid (0.228 to 0.236): the scatter is
       per cell, NOT per column. A column that consistently led its neighbours
       would read as vertical banding, which the reference does not have.

   The one deliberate departure is duration. Rob's whole wipe is 0.4s because it
   is a page transition; this one is a chapter changing underneath a reader who
   is being held still, and it is authored slow on purpose. Only the pacing
   differs -- the geometry is his.

   Its own module rather than constants beside the component, so that
   `BackgroundPixelTransition.tsx` exports only a component and fast refresh
   keeps working -- the same reason `statementLayers.ts` exists.
   ========================================================================== */

export interface PixelCellData {
  id: string;
  row: number;
  col: number;
  threshold: number;
}

/**
 * How deep a row's own scatter reaches, in rows.
 *
 * At 0 the wall arrives as a stack of perfectly flat lines. The reference sits
 * a little over two rows deep: enough that three or four distinct steps are in
 * flight at once, and still shallow enough that the whole thing travels upward
 * as one body rather than lighting at random.
 */
const EDGE_RAGGEDNESS = 2.2;

/**
 * Grid dimensions.
 *
 * Cells are square, and the column count is what sets their size. Ten columns
 * on a desktop viewport gives ~144px cells, within a dozen pixels of the
 * reference.
 *
 * Rows follow from the cell size rather than being chosen independently. The
 * grid stretches its rows to fill the container (`grid-template-rows:
 * repeat(var(--bg-rows), 1fr)`), so asking for the number of rows that WOULD be
 * square is what keeps them square once stretched. Deriving rows from anything
 * else -- a flatter target cell, say -- silently makes them letterboxes,
 * because the stretch has the final say and the CSS never learns what shape was
 * intended.
 *
 * Rounded up rather than to nearest: one more row is one more step in the
 * climb, and the slight squash it costs is not worth the step it buys back.
 */
export function getGridConfig(width: number, height: number): { cols: number; rows: number } {
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(height, 480);

  const cols = safeWidth >= 1280 ? 10 : safeWidth >= 768 ? 8 : 6;
  const cellSize = safeWidth / cols;
  const rows = Math.max(4, Math.ceil(safeHeight / cellSize));

  return { cols, rows };
}

/**
 * A stable value in [0, 1) for a cell, unrelated to its neighbours'.
 *
 * Deterministic, because thresholds are generated on mount and on resize and a
 * grid that reshuffled mid-beat would tear.
 *
 * An integer hash rather than a modulo of a linear combination: `(r * a + c *
 * b) % n` is a plane, and a plane sampled on a grid produces exactly the
 * diagonal banding this is trying to avoid.
 */
function scatter(row: number, col: number): number {
  let hash = (row * 73_856_093) ^ (col * 19_349_663);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_507);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_909);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4_294_967_296;
}

/**
 * Cells, with the thresholds that make the wall climb.
 *
 * Row 0 is the top of the grid and row `rows - 1` the bottom, so the bottom row
 * takes the lowest thresholds and lights first.
 *
 * A cell's threshold is its row's position plus a scatter scaled by ONE row's
 * share of the range times `EDGE_RAGGEDNESS`, so the scatter is measured in
 * rows and cannot be traded off against the row term. The arithmetic this
 * replaced mixed a 0.68-weighted row position with up to 0.22 of noise while a
 * row was worth only 0.097 -- which let a cell near the top light before cells
 * three rows beneath it.
 */
export function generateCells(cols: number, rows: number): PixelCellData[] {
  const rowShare = 1 / rows;
  const spread = EDGE_RAGGEDNESS * rowShare;

  const raw: { row: number; col: number; value: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // 0 at the bottom row, (rows - 1) / rows at the top row.
      const rise = (rows - 1 - r) * rowShare;
      raw.push({ row: r, col: c, value: rise + scatter(r, c) * spread });
    }
  }

  /*
   * Stretched onto the full [0, 1], from the values actually produced.
   *
   * Dividing by the theoretical maximum instead leaves headroom at both ends --
   * the scatter never quite reaches 0 or 1 -- and that headroom is dead time: a
   * slice of the beat at the start where nothing has lit yet, and a slice at the
   * end where the top row is already done.
   */
  let lowest = Infinity;
  let highest = -Infinity;
  for (const cell of raw) {
    if (cell.value < lowest) lowest = cell.value;
    if (cell.value > highest) highest = cell.value;
  }
  const range = highest - lowest || 1;

  return raw.map((cell, index) => ({
    id: `bg-cell-${index}`,
    row: cell.row,
    col: cell.col,
    threshold: Number(((cell.value - lowest) / range).toFixed(4)),
  }));
}
