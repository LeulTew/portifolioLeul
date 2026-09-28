/**
 * The page count drei's ScrollControls is given, and when a new one is worth
 * a track rebuild.
 *
 * ScrollControls translates its html layer by -(pages - 1) * viewportHeight
 * across the full scroll, so pages === contentHeight / viewportHeight maps the
 * content 1:1 onto the track: every section reachable, no dead scroll.
 */

/**
 * Page-count churn below this is ignored. Every applied change makes
 * ScrollControls rebuild its track, so the threshold is set well above routine
 * layout jitter -- roughly 135px on a 900px viewport -- while staying small
 * enough that no section becomes unreachable.
 */
export const SCROLL_PAGE_EPSILON = 0.15;

/** The pages content of this height needs; an unmeasured (zero) height is one screen. */
export function contentPages(contentHeight: number, viewportHeight: number): number {
  const height = viewportHeight || 1;
  return Math.max((contentHeight || height) / height, 1);
}

/** Whether a page count differs from the drawn one by enough to rebuild the track for. */
export function pagesChanged(next: number, drawn: number): boolean {
  return Math.abs(next - drawn) > SCROLL_PAGE_EPSILON;
}

/**
 * The content has grown or shrunk past the rebuild deadband, and the track
 * still draws the old count: a rebuild is owed that the content observer has
 * not reported yet (round 16, TECH-055; round 37).
 */
export function contentOutgrewTrack(content: HTMLElement | null, drawnPages: number, viewportHeight: number): boolean {
  return content !== null && pagesChanged(contentPages(content.scrollHeight, viewportHeight), drawnPages);
}
