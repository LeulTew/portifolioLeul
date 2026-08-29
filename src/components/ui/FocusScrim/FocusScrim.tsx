import { useEffect, useRef, useState } from 'react';
import styles from './FocusScrim.module.css';
import { focusStrength } from './focusStrength';

/**
 * Occludes the live 3D world behind the section that renders it.
 *
 * Long-form copy over moving terrain is unreadable at almost any opacity. The
 * scrim fades up as its section takes over the viewport and fades back out as
 * the section leaves, so the world returns between reading passages.
 *
 * Render it as a direct child of a positioned section; it measures that parent.
 */

/** Enough to carry text contrast while the world stays faintly present. */
const DEFAULT_MAX_OPACITY = 0.92;

/** Coverage steps sampled by the observer. More steps means a smoother ramp. */
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

export interface FocusScrimProps {
  /** Peak scrim opacity. */
  maxOpacity?: number;
}

export function FocusScrim({ maxOpacity = DEFAULT_MAX_OPACITY }: FocusScrimProps = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [strength, setStrength] = useState(0);

  useEffect(() => {
    const section = ref.current?.parentElement;
    if (!section || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;

        const rootHeight =
          entry.rootBounds?.height ??
          (typeof window !== 'undefined' ? window.innerHeight : 0);

        const visibleHeight = entry.isIntersecting
          ? (entry.intersectionRect?.height ?? 0)
          : 0;

        setStrength(focusStrength(visibleHeight, rootHeight));
      },
      { threshold: THRESHOLDS }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={styles.scrim}
      style={{ opacity: strength * maxOpacity }}
      aria-hidden="true"
      data-testid="focus-scrim"
      data-focus-strength={strength.toFixed(3)}
    />
  );
}
