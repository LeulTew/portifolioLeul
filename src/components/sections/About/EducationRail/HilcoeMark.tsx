import { useId } from 'react';
import styles from './EducationRail.module.css';

/**
 * HiLCoE's badge, as supplied.
 *
 * The geometry is reproduced exactly and never distorted -- the reveal is a
 * clipping circle opening from the centre while the rim draws itself round, so
 * the mark is uncovered rather than animated. Scaling or sliding a real
 * institution's badge would be taking liberties with someone else's identity.
 *
 * Colour is the one thing that is not baked in. Every shape carries a class
 * and takes its fill and stroke from the stylesheet, so the badge can sit in
 * the section as white line-art and come up in its own colours under the
 * reader's cursor. Presentation attributes could not do that: `fill="var(--x)"`
 * is not a CSS declaration and browsers do not resolve it.
 *
 * Both the clip and the reveal need ids, and ids in a document have to be
 * unique -- `useId` gives one per instance. Its output contains colons, which
 * are not valid inside a `url(#...)` reference, so they are stripped.
 */
export function HilcoeMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const badgeClip = `${uid}-badge`;
  const revealClip = `${uid}-reveal`;

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label="HiLCoE School of Computer Science & Technology"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={badgeClip}>
          <circle cx="200" cy="200" r="172" />
        </clipPath>
        <clipPath id={revealClip}>
          {/* Opened from 0 by the crossing; full size when nothing animates it. */}
          <circle className={styles.markReveal} cx="200" cy="200" r="172" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${revealClip})`}>
        <circle className={styles.markDisc} cx="200" cy="200" r="172" />

        <g clipPath={`url(#${badgeClip})`}>
          {/* Top-left ribbon */}
          <path
            className={styles.markPaper}
            d="M 194,29
               C 142,32 94,62 72,108
               C 61,130 62,158 72,176
               C 78,187 86,193 95,195
               C 85,183 79,165 80,140
               C 82,112 94,86 112,65
               C 132,46 160,35 194,29 Z"
          />

          {/* Bottom-right swoosh */}
          <path
            className={styles.markPaper}
            d="M 152,360
               C 182,369 220,369 248,354
               C 264,345 273,332 276,316
               C 270,326 256,336 240,344
               C 214,357 182,360 152,360 Z"
          />

          {/* Diagonal stripe */}
          <polygon className={styles.markAccent} points="126,180 230,252 255.5,295 126,210" />

          {/* N: right stem with top serif */}
          <path
            className={styles.markPaper}
            d="M 270,76
               L 312,76
               L 308,94
               L 308,316
               L 276,316
               L 276,96
               Z"
          />

          {/* N: diagonal, over the right stem */}
          <polygon className={styles.markPaper} points="126,76 156,76 298,316 268,316" />

          {/* N: left stem, over the diagonal */}
          <rect className={styles.markPaper} x="95" y="76" width="31" height="240" />
        </g>
      </g>

      {/*
        Outside the reveal, so the rim can draw itself round the badge while the
        badge is still opening. `pathLength="1"` makes that one dash offset from
        1 to 0, whatever the circle's real circumference.
      */}
      <circle className={styles.markRim} cx="200" cy="200" r="172" pathLength="1" />
    </svg>
  );
}
