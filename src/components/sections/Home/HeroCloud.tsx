import { useEffect, useId, useRef, useState } from 'react';
import styles from './HeroCloud.module.css';

export interface HeroCloudProps {
  className?: string;
  /** Pauses ambient drift; visibility and entrance/exit belong to Home. */
  active?: boolean;
  /** Inherits the ancestor's data-theme when omitted. */
  theme?: string;
}

const CLOUD_CONTOUR = [
  'M 66 311',
  'C 110 286 163 312 192 268',
  'C 209 242 173 226 224 198',
  'C 258 179 302 197 322 160',
  'C 341 122 388 147 418 117',
  'C 460 77 506 129 556 108',
  'C 606 86 626 138 683 128',
  'C 740 116 746 174 799 165',
  'C 865 150 914 183 909 224',
  'C 966 206 985 256 1042 250',
  'C 1084 246 1099 273 1140 278',
  'C 1092 307 1012 280 972 319',
  'C 1015 344 1053 325 1101 350',
  'C 1057 375 1003 354 961 388',
  'C 910 427 865 391 837 443',
  'C 810 491 745 459 708 493',
  'C 667 532 617 492 573 520',
  'C 532 548 487 508 446 527',
  'C 389 550 365 502 311 503',
  'C 254 505 272 453 220 458',
  'C 163 463 190 412 130 410',
  'C 100 408 93 384 54 377',
  'C 102 354 144 372 174 347',
  'C 148 322 110 342 66 311 Z',
].join(' ');

/**
 * Static SVG pigment and feathering, with two transform-only drifting layers.
 * The light shear suggests refraction; it does not resample or distort the scene.
 */
export function HeroCloud({ className, active = true, theme }: HeroCloudProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);
  const id = `hero-cloud-${useId().replace(/:/g, '')}`;
  const cloudTheme = theme === 'light' || theme === 'dark' ? theme : undefined;

  useEffect(() => {
    const root = rootRef.current;
    setMoving(false);
    if (!root || !active) return;

    let disposed = false;
    let inView = false;
    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    const syncMotion = () => {
      if (!disposed) {
        setMoving(
          inView
          && document.visibilityState !== 'hidden'
          && !motionQuery?.matches,
        );
      }
    };
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
        const entry = entries.find((candidate) => candidate.target === root);
        if (!entry) return;
        inView = entry.isIntersecting && entry.intersectionRatio > 0;
        syncMotion();
      }, { threshold: 0 })
      : null;

    // Without intersection support the decorative fallback remains still.
    observer?.observe(root);
    document.addEventListener('visibilitychange', syncMotion);
    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener('change', syncMotion);
    } else {
      motionQuery?.addListener(syncMotion);
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', syncMotion);
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener('change', syncMotion);
      } else {
        motionQuery?.removeListener(syncMotion);
      }
    };
  }, [active]);

  return (
    <div
      ref={rootRef}
      className={[styles.cloud, className].filter(Boolean).join(' ')}
      aria-hidden="true"
      data-hero-cloud=""
      data-cloud-theme={cloudTheme}
      data-motion={active && moving ? 'running' : 'paused'}
    >
      <svg
        className={styles.body}
        viewBox="0 0 1200 640"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <radialGradient id={`${id}-density`} cx="46%" cy="51%" r="58%">
            <stop offset="0" stopColor="var(--cloud-core)" stopOpacity=".88" />
            <stop offset=".48" stopColor="var(--cloud-core)" stopOpacity=".8" />
            <stop offset=".77" stopColor="var(--cloud-core)" stopOpacity=".36" />
            <stop offset="1" stopColor="var(--cloud-core)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-vapor`} cx="48%" cy="46%" r="56%">
            <stop offset="0" stopColor="var(--cloud-vapor)" stopOpacity=".1" />
            <stop offset=".42" stopColor="var(--cloud-vapor)" stopOpacity=".58" />
            <stop offset=".75" stopColor="var(--cloud-vapor)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--cloud-vapor)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2=".2">
            <stop offset="0" stopColor="var(--cloud-light)" stopOpacity="0" />
            <stop offset=".32" stopColor="var(--cloud-light)" stopOpacity=".16" />
            <stop offset=".58" stopColor="var(--cloud-light)" stopOpacity=".25" />
            <stop offset="1" stopColor="var(--cloud-light)" stopOpacity="0" />
          </linearGradient>
          <filter
            id={`${id}-edge`}
            x="0" y="0" width="1200" height="640"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise" baseFrequency=".013 .024"
              numOctaves="2" seed="8" result="edgeNoise"
            />
            <feDisplacementMap
              in="SourceGraphic" in2="edgeNoise" scale="28"
              xChannelSelector="R" yChannelSelector="G"
            />
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter
            id={`${id}-texture`}
            x="0" y="0" width="1200" height="640"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise" baseFrequency=".006 .018"
              numOctaves="3" seed="17" result="vaporNoise"
            />
            <feColorMatrix
              in="vaporNoise" type="matrix"
              values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .65 .65 .65 0 -.5"
              result="vaporAlpha"
            />
            <feComposite in="SourceGraphic" in2="vaporAlpha" operator="in" />
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter
            id={`${id}-soften`}
            x="0" y="0" width="1200" height="640"
            filterUnits="userSpaceOnUse"
          >
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <path
          d={CLOUD_CONTOUR}
          fill={`url(#${id}-density)`}
          filter={`url(#${id}-edge)`}
        />
      </svg>

      <div className={styles.vapor}>
        <svg viewBox="0 0 1200 640" preserveAspectRatio="none" focusable="false">
          <g fill={`url(#${id}-vapor)`} filter={`url(#${id}-texture)`}>
            <path d={CLOUD_CONTOUR} />
            <path d="M 126 269 C 260 245 260 92 436 115 C 586 135 574 56 704 111 C 831 166 874 118 1042 241 C 891 168 799 215 695 171 C 586 127 492 201 371 161 C 263 130 245 272 126 269 Z" />
            <path d="M 104 405 C 238 388 264 494 433 465 C 577 440 580 551 750 493 C 849 460 927 498 1107 374 C 951 440 885 409 756 450 C 613 496 553 409 426 431 C 302 450 234 372 104 405 Z" />
          </g>
        </svg>
      </div>

      <div className={styles.shear}>
        <svg viewBox="0 0 1200 640" preserveAspectRatio="none" focusable="false">
          <g filter={`url(#${id}-soften)`}>
            <path
              d="M 170 288 C 339 168 481 256 609 204 C 734 153 878 255 1052 235 C 879 276 747 184 615 221 C 457 268 335 193 170 288 Z"
              fill={`url(#${id}-light)`}
            />
            <path
              d="M 205 433 C 383 360 471 458 658 400 C 799 356 859 434 1020 356 C 875 448 789 378 662 414 C 484 474 373 377 205 433 Z"
              fill="var(--cloud-shade)"
              opacity=".07"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
