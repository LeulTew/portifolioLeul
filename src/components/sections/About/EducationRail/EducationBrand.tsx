import type { WheelEventHandler } from 'react';
import styles from './EducationRail.module.css';

export function BootdevBrand({ onWheel }: { onWheel?: WheelEventHandler<HTMLDivElement> }) {
  return (
    <div className={styles.brand} data-edu-brand="">
      <div className={styles.brandStamp} onWheel={onWheel}>
        <img
          className={`${styles.brandImage} ${styles.brandColor}`}
          data-edu-brand-color=""
          src="/images/education/bootdev-color.webp"
          width={256}
          height={121}
          alt="Boot.dev"
          loading="lazy"
          decoding="async"
        />
        <img
          className={`${styles.brandImage} ${styles.brandWhite}`}
          data-edu-brand-white=""
          src="/images/education/bootdev-white.webp"
          width={256}
          height={105}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

export function CertificationDiagram({ kind }: { kind: 'logic' | 'responsive' }) {
  return (
    <svg
      className={styles.certificateDiagram}
      data-edu-diagram={kind}
      viewBox="0 0 96 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'logic' ? (
        <>
          <path data-edu-draw="" pathLength="1" d="M28 14h18v36H28M46 32h20" />
          <rect data-edu-draw="" pathLength="1" x="10" y="6" width="18" height="16" rx="3" />
          <rect data-edu-draw="" pathLength="1" x="10" y="42" width="18" height="16" rx="3" />
          <path data-edu-draw="" pathLength="1" d="m76 22 10 10-10 10-10-10Z" fill="var(--accent)" />
          <path data-edu-draw="" pathLength="1" d="m16 12-3 2 3 2m6-4 3 2-3 2M16 50h6" />
        </>
      ) : (
        <>
          <rect data-edu-draw="" pathLength="1" x="6" y="8" width="60" height="42" rx="4" />
          <path data-edu-draw="" pathLength="1" d="M6 19h60M27 50v8m18-8v8M21 58h30" />
          <rect data-edu-draw="" pathLength="1" x="15" y="27" width="16" height="14" rx="2" fill="var(--accent)" />
          <path data-edu-draw="" pathLength="1" d="M38 28h17M38 34h12M38 40h15" />
          <rect data-edu-draw="" pathLength="1" x="72" y="27" width="18" height="31" rx="4" />
          <path data-edu-draw="" pathLength="1" d="M77 34h8M77 39h8M77 44h5M80 52h2" />
        </>
      )}
    </svg>
  );
}
