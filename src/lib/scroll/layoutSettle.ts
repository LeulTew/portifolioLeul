/**
 * How long a layout just mounted or resized is taken to be still settling: past App's content
 * settle (120ms) and track rebuild, and short of anything the reader does next. A linear chapter
 * takes the reader's place from it only after this, unless the reader has moved it themselves:
 * a half-built page's positions are not a place anyone read (round 22, D-MOTION-005), and input
 * alone is not the only way a reader moves -- the browser's own find moves the page with none
 * (round 23, TECH-067).
 */
export const LAYOUT_SETTLE_MS = 600;
