import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './StripReveal.module.css';
import {
  DEFAULT_STRIP_COUNT,
  calculateStripTransform,
  stripDelayFraction,
} from '@/lib/motion/stripTransform';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';

/**
 * Sweeps a bending sheet of narrow strips across its children whenever
 * `revealKey` changes.
 *
 * Used where content is replaced wholesale -- switching project category, for
 * instance -- so the swap reads as a sheet being turned over rather than as a
 * hard cut. The strips are an overlay: the children are never unmounted, so no
 * state, scroll position or media is lost to the transition.
 */

/** Sweep duration, before per-strip stagger. */
const SWEEP_MS = 620;

/** Stagger across the sheet, as a share of the sweep. */
const MAX_STAGGER = 0.35;

/** Mid-sweep is where the sheet is most bent, so that is the covering pose. */
const COVERED_PROGRESS = 0.5;

type Phase = 'idle' | 'covering' | 'clearing';

export interface StripRevealProps {
  /** Changing this plays a sweep. */
  revealKey: string | number;
  strips?: number;
  children: ReactNode;
  className?: string;
}

export function StripReveal({
  revealKey,
  strips = DEFAULT_STRIP_COUNT,
  children,
  className,
}: StripRevealProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const previousKey = useRef(revealKey);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (previousKey.current === revealKey) return;
    previousKey.current = revealKey;

    // The sweep decorates a content swap that has already happened; under
    // reduced motion the swap simply stands on its own.
    if (getPrefersReducedMotion()) return;

    setPhase('covering');
  }, [revealKey]);

  useEffect(() => {
    if (phase !== 'covering') return;

    // Release on the next frame, so the browser has painted the covering pose
    // and has something to transition away from.
    frameRef.current = requestAnimationFrame(() => setPhase('clearing'));

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'clearing') return;

    timeoutRef.current = setTimeout(
      () => setPhase('idle'),
      SWEEP_MS * (1 + MAX_STAGGER)
    );

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [phase]);

  const isClearing = phase === 'clearing';

  return (
    <div className={className ? `${styles.container} ${className}` : styles.container}>
      {children}

      {phase !== 'idle' && (
        <div
          className={styles.strips}
          aria-hidden="true"
          data-testid="strip-sheet"
          data-phase={phase}
        >
          {Array.from({ length: strips }, (_, index) => {
            const bent = calculateStripTransform(index, strips, COVERED_PROGRESS);
            const delay = stripDelayFraction(index, strips, MAX_STAGGER) * SWEEP_MS;
            const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';

            return (
              <div
                key={index}
                className={styles.strip}
                data-testid="strip"
                style={{
                  transform: isClearing ? 'rotateY(0deg)' : `rotateY(${bent.angle}deg)`,
                  opacity: isClearing ? 0 : 1,
                  transition: isClearing
                    ? `transform ${SWEEP_MS}ms ${easing} ${delay}ms, opacity ${SWEEP_MS}ms ${easing} ${delay}ms`
                    : 'none',
                  ['--strip-shadow' as string]: String(
                    isClearing ? 0 : bent.shadowOpacity
                  ),
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
