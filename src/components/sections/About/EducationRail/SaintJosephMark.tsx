import { useState } from 'react';
import styles from './EducationRail.module.css';

/** Where the two files live. Relative to `public`, so served from the root. */
export const SAINT_JOSEPH_WHITE = '/images/education/saint-joseph.webp';
export const SAINT_JOSEPH_COLOUR = '/images/education/saint-joseph-colour.webp';

/**
 * Saint Joseph's seal.
 *
 * Deliberately not built like HiLCoE's badge. Two institutions, not one template.
 * Sits on the left side of the record with an astrolabe orbital compass ring,
 * rotating into alignment on arrival, with its rich crimson and royal gold emblem
 * revealed strictly when hovering directly on the circular insignia.
 */
export function SaintJosephMark({ className }: { className?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;

  return (
    <div className={`${styles.sealWrapper} ${className ?? ''}`}>
      {/* Astrolabe / Heritage compass decorative outer ring */}
      <svg
        className={styles.sealRing}
        viewBox="0 0 240 240"
        fill="none"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer orbital hairline */}
        <circle cx="120" cy="120" r="116" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" opacity="0.35" />
        <circle cx="120" cy="120" r="110" stroke="currentColor" strokeWidth="0.75" opacity="0.2" />
        {/* Cardinal orientation ticks */}
        <line x1="120" y1="0" x2="120" y2="8" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1="120" y1="232" x2="120" y2="240" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1="0" y1="120" x2="8" y2="120" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <line x1="232" y1="120" x2="240" y2="120" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        {/* Subtle diagonal pips */}
        <circle cx="38" cy="38" r="1.5" fill="currentColor" opacity="0.4" />
        <circle cx="202" cy="38" r="1.5" fill="currentColor" opacity="0.4" />
        <circle cx="38" cy="202" r="1.5" fill="currentColor" opacity="0.4" />
        <circle cx="202" cy="202" r="1.5" fill="currentColor" opacity="0.4" />
      </svg>

      {/* The circular interactive seal button — strictly only this circle takes hover */}
      <div className={styles.sealDisc}>
        <picture>
          <source srcSet={SAINT_JOSEPH_WHITE} type="image/webp" />
          <img
            className={styles.sealWhite}
            src="/images/education/saint-joseph.png"
            alt="Saint Joseph School"
            width={512}
            height={512}
            loading="eager"
            decoding="async"
            onError={() => setMissing(true)}
          />
        </picture>

        {/* The same seal, in its rich crimson and gold colours */}
        <picture>
          <source srcSet={SAINT_JOSEPH_COLOUR} type="image/webp" />
          <img
            className={styles.sealColour}
            src="/images/education/saint-joseph-colour.png"
            alt=""
            aria-hidden="true"
            width={512}
            height={512}
            loading="eager"
            decoding="async"
          />
        </picture>
      </div>
    </div>
  );
}

