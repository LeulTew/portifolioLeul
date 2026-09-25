import { useLayoutEffect, useMemo, useRef, type WheelEvent } from 'react';
import { writeAttribute } from '@/lib/dom/cachedElement';
import styles from './ScrollCue.module.css';
import { CUE_BASE_HEIGHT, CUE_VIEW_WIDTH, CUE_VIEW_Y, CUE_RUN_X, CUE_START_X, cueViewX } from './cueGeometry';

/** Dash lengths in the stylesheet are percentages of the path, not units. */
const PATH_LENGTH = 100;

const BASE_END = 368;
const CURVE_START_Y = 12;
const CURVE_END_Y = 324;

/** Three broad turns span the rail, keeping vertical tangents at every join. */
function traceFor(run: number): string {
  const y = (value: number) =>
    (value + run * ((value - CURVE_START_Y) / (CURVE_END_Y - CURVE_START_Y))).toFixed(3);
  return `M ${CUE_START_X} ${CURVE_START_Y} ` +
    `C ${CUE_START_X} ${y(64)} 14 ${y(70)} 14 ${y(128)} ` +
    `C 14 ${y(184)} 182 ${y(180)} 182 ${y(236)} ` +
    `C 182 ${y(280)} ${CUE_RUN_X} ${y(282)} ${CUE_RUN_X} ${y(CURVE_END_Y)} ` +
    `L ${CUE_RUN_X} ${BASE_END + run}`;
}

/**
 * Chevron at the end of the line, aligned to the tangent there.
 *
 * The straight run leaves the line vertical, so the head points straight down
 * and its tip sits on the trace's last point.
 */
function headFor(run: number): string {
  const end = BASE_END + run;
  return `M ${CUE_RUN_X - 10} ${end - 15} L ${CUE_RUN_X} ${end} L ${CUE_RUN_X + 10} ${end - 15}`;
}

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
  /**
   * Extra vertical span, in viewBox units, distributed through the three turns.
   *
   * The mark spans the gap between the hero and About, and that gap is a
   * measured number of pixels rather than a shape -- so how long the line runs
   * is the caller's to decide. Use `cueRunForHeight` to turn a height into it.
   */
  run?: number;
  /** Turn the same curve inward when the heading's margin cannot fit its bow. */
  mirrored?: boolean;
  /** The caller's actual rail/chapter presentation, independent of SVG progress. */
  presented?: boolean;
  onActivate?: () => void;
  onFocusRelease?: () => void;
  /** For a cue rendered outside the scroll layer, so wheel over it still moves the page. */
  onWheel?: (event: WheelEvent<HTMLButtonElement>) => void;
  className?: string;
  label?: string;
  /** The section a cue portalled out of it belongs to, for keyboard order. */
  sectionOwner?: string;
}

export function ScrollCue({
  progress = 0,
  run = 0,
  mirrored = false,
  presented = true,
  onActivate,
  onFocusRelease,
  onWheel,
  className,
  label = 'Scroll to the next section',
  sectionOwner,
}: ScrollCueProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const drawn = clamp01(progress);
  const available = presented && drawn > 0;
  const runUnits = Number.isFinite(run) && run > 0 ? run : 0;
  const { trace, head } = useMemo(() => ({
    trace: traceFor(runUnits),
    head: headFor(runUnits),
  }), [runUnits]);

  // The head lands only once the line reaches it.
  const headDrawn = clamp01((drawn - 0.75) / 0.25);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    // Recover focus before disabling/hiding: browsers may otherwise drop it
    // to body before the caller can return it to the visible navigation.
    if (!available && document.activeElement === button) {
      onFocusRelease?.();
      if (document.activeElement === button) button.blur();
    }
    button.disabled = !available;
    writeAttribute(button, 'inert', available ? null : '');
    writeAttribute(button, 'aria-hidden', available ? null : 'true');
  }, [available, onFocusRelease]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={[styles.cue, className].filter(Boolean).join(' ')}
      aria-label={label}
      data-testid="scroll-cue"
      data-progress={drawn.toFixed(3)}
      data-drawing={drawn > 0}
      data-presented={available}
      data-section-owner={sectionOwner}
      tabIndex={available ? 0 : -1}
      onClick={available ? onActivate : undefined}
      onWheel={onWheel}
    >
      <svg
        className={styles.drawing}
        viewBox={`${cueViewX(mirrored)} ${CUE_VIEW_Y} ${CUE_VIEW_WIDTH} ${CUE_BASE_HEIGHT + runUnits}`}
        preserveAspectRatio="xMinYMin meet"
        aria-hidden="true"
        focusable="false"
      >
      <g transform={mirrored ? `translate(${2 * CUE_RUN_X} 0) scale(-1 1)` : undefined}>
      <path
        className={`${styles.stroke} ${styles.trace}`}
        d={trace}
        pathLength={PATH_LENGTH}
        strokeDashoffset={PATH_LENGTH * (1 - drawn)}
        data-testid="scroll-cue-trace"
      />
      <path
        className={`${styles.stroke} ${styles.head}`}
        d={head}
        pathLength={PATH_LENGTH}
        strokeDashoffset={PATH_LENGTH * (1 - headDrawn)}
        data-testid="scroll-cue-head"
      />
      {/* Rides the same geometry, so the current runs down the line it drew. */}
      <path
        className={styles.current}
        d={trace}
        pathLength={PATH_LENGTH}
        data-testid="scroll-cue-current"
        data-flowing={available && drawn > 0.99}
      />
      </g>
      </svg>
    </button>
  );
}
