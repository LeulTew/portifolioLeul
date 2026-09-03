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

/**
 * Decimal places published for each value.
 *
 * Three is finer than anything downstream can show -- a thousandth of an
 * opacity, or a hundredth of a pixel of blur -- and it means a slow scroll
 * produces the same string on consecutive frames, which is what makes the
 * skip below worth having.
 */
const PRECISION = 3;

/** Sets a property only if it differs, and reports whether it did. */
function write(element: HTMLElement, property: string, value: string): boolean {
  if (element.style.getPropertyValue(property) === value) return false;
  element.style.setProperty(property, value);
  return true;
}

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

    /*
     * Whether the spacer is anywhere near the screen.
     *
     * Reading a rect forces the browser to flush layout, and this runs on
     * every frame the scroll store publishes -- for the whole page, not just
     * for this stretch. The sequence can only be pinned while its spacer is on
     * screen, so away from it the layout flush buys nothing at all.
     */
    let nearby = true;

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          nearby = entry.isIntersecting;
          if (!nearby && overlayRef.current) {
            // An overlay is fixed to the viewport, so one left switched on
            // covers every section after it.
            overlayRef.current.dataset.active = 'false';
          }
        },
        { rootMargin: '100% 0px' }
      );
      observer.observe(spacer);
    }

    const apply = () => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      if (!nearby) return;

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

      /*
       * Written only when the value actually changes.
       *
       * Every setProperty invalidates style for the subtree whether or not the
       * value differs, and this runs on every frame for the length of the
       * stretch. During a slow scroll most frames round to what was already
       * there, so most of that work is for nothing -- and a blur re-rasterises
       * on any change at all.
       */
      write(overlay, '--seq', progress.toFixed(PRECISION));

      for (const layer of layers) {
        const presence = windowPresence(
          progress,
          layer.start,
          layer.end,
          layer.feather ?? DEFAULT_FEATHER
        );
        write(overlay, `--${layer.name}-in`, presence.toFixed(PRECISION));
        write(
          overlay,
          `--${layer.name}-on`,
          layerOpacity(presence).toFixed(PRECISION)
        );
      }
    };

    apply();
    const unsubscribe = subscribeScrollProgress(apply);
    window.addEventListener('resize', apply);

    /*
     * Native scroll as well as the canvas's.
     *
     * Scroll progress is published by the scroll controls inside the Canvas,
     * and on a browser that will not give us a WebGL context there is no
     * Canvas -- so nothing published, `apply` never ran, and the stretch's
     * overlay stayed switched off. About rendered as a black screen, because
     * everything it shows lives in that overlay.
     *
     * Passive, and in the 3D path the document itself never scrolls, so this
     * costs a listener that is never called.
     */
    window.addEventListener('scroll', apply, { passive: true });

    return () => {
      unsubscribe();
      observer?.disconnect();
      window.removeEventListener('resize', apply);
      window.removeEventListener('scroll', apply);
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
