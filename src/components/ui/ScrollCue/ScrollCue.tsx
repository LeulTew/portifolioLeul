import styles from './ScrollCue.module.css';

/**
 * The mark between the hero and About: a bracket that draws itself as the
 * reader begins moving toward the next section.
 *
 * The geometry is the original mark's, recovered from the border-radius it
 * used to be drawn with. That box was 1200x300 with `border-radius: 230px 0 0
 * 150px` and only its left border painted. CSS scales all radii by 300/380
 * when a side's radii overflow it, giving corner radii of 181.6 and 118.4, no
 * straight edge at all, and borders that split each corner on the 45 degree
 * diagonal -- so the painted edge is exactly two arcs bulging out to the left.
 *
 * A border cannot be drawn on, which is why it had to become a path.
 */

/** Dash lengths in the stylesheet are percentages of the path, not units. */
const PATH_LENGTH = 100;

/**
 * Upper arc out to the bulge, the lower arc back in, then a reversed arc that
 * takes the 45 degree tangent round to vertical and a straight run down.
 *
 * The original two arcs stopped mid-air travelling diagonally, which left the
 * mark pointing off to one side of the section below it. The S-bend turns that
 * tangent to plumb: the line leaves the hero heading straight down, and the run
 * carries it to the edge, so it reads as a connection between the two sections
 * rather than a flourish sitting inside one of them.
 *
 * The turn is a 60-radius arc centred at (-7.7, 307.7) -- the point 60 to the
 * left of the tangent -- which is the unique arc leaving (34.7, 265.3) at 45
 * degrees and arriving at (52.3, 307.7) pointing straight down.
 */
const TRACE =
  'M 53.2 53.2 A 181.6 181.6 0 0 0 0 181.6 A 118.4 118.4 0 0 0 34.7 265.3 ' +
  'A 60 60 0 0 1 52.3 307.7 L 52.3 380';

/**
 * Chevron at the end of the line, aligned to the tangent there.
 *
 * The straight run leaves the line vertical, so the head points straight down
 * and its tip sits on the trace's last point. Barbs are 19 long at 34 degrees
 * either side of the run.
 */
const HEAD = 'M 41.7 364.3 L 52.3 380 L 62.9 364.3';

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 : value;
}

export interface ScrollCueProps {
  /**
   * How far the reader has moved toward the next section, 0 to 1. The line is
   * traced in step with it, so the mark is drawn by the act of scrolling
   * rather than played at the reader on arrival.
   */
  progress?: number;
  onActivate?: () => void;
  className?: string;
  label?: string;
}

export function ScrollCue({
  progress = 0,
  onActivate,
  className,
  label = 'Scroll to the next section',
}: ScrollCueProps) {
  const drawn = clamp01(progress);

  // The head lands only once the line reaches it.
  const headDrawn = clamp01((drawn - 0.75) / 0.25);

  return (
    <svg
      className={[styles.cue, className].filter(Boolean).join(' ')}
      viewBox="-2 50 67 334"
      preserveAspectRatio="xMinYMin meet"
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid="scroll-cue"
      data-progress={drawn.toFixed(3)}
      data-drawing={drawn > 0}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate?.();
        }
      }}
    >
      <path
        className={`${styles.stroke} ${styles.trace}`}
        d={TRACE}
        pathLength={PATH_LENGTH}
        strokeDashoffset={PATH_LENGTH * (1 - drawn)}
        data-testid="scroll-cue-trace"
      />
      <path
        className={`${styles.stroke} ${styles.head}`}
        d={HEAD}
        pathLength={PATH_LENGTH}
        strokeDashoffset={PATH_LENGTH * (1 - headDrawn)}
        data-testid="scroll-cue-head"
      />
      {/* Rides the same geometry, so the current runs down the line it drew. */}
      <path
        className={styles.current}
        d={TRACE}
        pathLength={PATH_LENGTH}
        data-testid="scroll-cue-current"
        data-flowing={drawn > 0.99}
      />
    </svg>
  );
}
