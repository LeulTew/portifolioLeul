import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { windowPresence, layerOpacity } from '@/lib/motion/sequenceWindow';
import { localProgress } from './localProgress';
import styles from './PinnedSequence.module.css';

/**
 * A stretch of scroll the reader is held inside.
 *
 * A spacer in the flow provides the scroll; the content is a fixed overlay, so
 * the background does not move at all while that scroll is spent. Things
 * appear on it, hold, and leave -- which is what makes it feel like standing
 * still while something happens, rather than like passing a tall section.
 *
 * Two things make this work here and neither is optional.
 *
 * The overlay is portalled to the body. `position: fixed` is relative to the
 * nearest transformed ancestor, and every section on this page lives inside
 * drei's `Scroll html`, which is positioned by a transform -- so a fixed child
 * of a section is not fixed to the screen at all, it rides the scroll with
 * everything else.
 *
 * The progress is read per frame from the scroll store and written straight to
 * CSS custom properties on the overlay, never into React state. The store
 * publishes every frame; routing that through a re-render would re-render the
 * whole section sixty times a second to change two numbers.
 */

export interface SequenceLayer {
  /** Matches the `--<name>-in` and `--<name>-on` properties in the CSS. */
  name: string;
  /** Where this layer takes and gives up the stage, in [0, 1]. */
  start: number;
  end: number;
  /** Length of each ramp, in the same units. */
  feather?: number;
}

export interface PinnedSequenceProps {
  /** How many screens of scroll the sequence consumes. */
  screens?: number;
  layers: readonly SequenceLayer[];
  children: ReactNode;
  className?: string;
  /** Marks the spacer, so a test can find the scroll it reserves. */
  testId?: string;
}

const DEFAULT_FEATHER = 0.09;

export function PinnedSequence({
  screens = 3,
  layers,
  children,
  className,
  testId = 'pinned-sequence',
}: PinnedSequenceProps) {
  const [spacer, setSpacer] = useState<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!spacer) return;

    const apply = () => {
      const overlay = overlayRef.current;
      if (!overlay) return;

      const rect = spacer.getBoundingClientRect();
      const rootHeight = window.innerHeight;
      const progress = localProgress(rect.top, rect.height, rootHeight);

      /*
       * Shown only while the stretch is actually being held, which is a
       * narrower window than being on screen at all.
       *
       * Intersecting is not the test. The spacer starts intersecting a whole
       * screen before it reaches the top, so an overlay switched on by
       * intersection is drawn over whatever still sits above it -- the
       * section's own heading, in this case, with the held content laid across
       * it. The reader should scroll TO the stretch, and only then be held.
       *
       * Hidden outright rather than left transparent: an overlay is fixed to
       * the viewport, so one merely faded out still covers every section after
       * it for the rest of the page.
       */
      const pinned = rect.top <= 0 && rect.bottom >= rootHeight;
      overlay.dataset.active = String(pinned);
      if (!pinned) return;

      overlay.style.setProperty('--seq', progress.toFixed(4));
      for (const layer of layers) {
        const presence = windowPresence(
          progress,
          layer.start,
          layer.end,
          layer.feather ?? DEFAULT_FEATHER
        );
        overlay.style.setProperty(`--${layer.name}-in`, presence.toFixed(4));
        overlay.style.setProperty(
          `--${layer.name}-on`,
          layerOpacity(presence).toFixed(4)
        );
      }
    };

    apply();
    const unsubscribe = subscribeScrollProgress(apply);
    window.addEventListener('resize', apply);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', apply);
    };
  }, [spacer, layers]);

  return (
    <>
      <div
        ref={setSpacer}
        className={styles.spacer}
        style={{ height: `${screens * 100}vh` }}
        data-testid={testId}
        aria-hidden="true"
      />
      {mounted &&
        createPortal(
          <div
            ref={overlayRef}
            className={[styles.overlay, className].filter(Boolean).join(' ')}
            data-active="false"
            data-testid={`${testId}-overlay`}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
