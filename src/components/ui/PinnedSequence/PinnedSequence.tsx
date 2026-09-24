import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getScrollProgress, setScrollProgress, subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { windowPresence, layerOpacity } from '@/lib/motion/sequenceWindow';
import { localProgress } from './localProgress';
import { writeAttribute, writeStyleProperty } from '@/lib/dom/cachedElement';
import { setOverlayOcclusion } from '@/lib/camera/cameraHold';
import { getProjectsView, isProjectsReturnOwed } from '@/lib/projects/projectsScene';
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
  /** The ground layer fully covers the 3D world when its presence reaches one. */
  occludesWorld?: boolean;
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

export function PinnedSequence({
  screens = 3,
  layers,
  children,
  className,
  testId = 'pinned-sequence',
  occludesWorld = false,
}: PinnedSequenceProps) {
  const [spacer, setSpacer] = useState<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!spacer) return;
    const home = document.getElementById('home');
    const section = spacer.closest<HTMLElement>('section[id]');
    const publishOwnership = (active: boolean) => {
      if (section) writeAttribute(section, 'data-sequence-active', active ? 'true' : null);
    };

    /*
     * Whether the spacer is anywhere near the screen.
     *
     * Reading a rect forces the browser to flush layout, and this runs on
     * every frame the scroll store publishes -- for the whole page, not just
     * for this stretch. The sequence can only be pinned while its spacer is on
     * screen, so away from it the layout flush buys nothing at all.
     */
    /**
     * Whether the chapter still owes the reader a movement.
     *
     * Something has started and the last thing has not finished. Monotone in
     * both directions, with a terminal state at each end -- `title-settled`
     * going down, nothing set at all coming back up -- so it cannot latch on.
     */
    const chapterBusy = () => {
      const aboutEl =
        typeof document !== 'undefined' ? document.getElementById('about') : null;
      if (!aboutEl) return false;
      const flag = (name: string) => aboutEl.getAttribute(name) === 'true';
      /*
       * The heading's own journey, which is owed in both directions and is the
       * only beat that can still be running once every other one has finished.
       */
      if (flag('data-head-pending') || flag('data-head-travelling') ||
          flag('data-education-returning')) return true;
      const started =
        flag('data-statements-present') ||
        flag('data-head-settled') ||
        flag('data-statements-cleared') ||
        flag('data-bg-active') ||
        flag('data-bg-settled') ||
        flag('data-title-active') ||
        flag('data-title-settled') ||
        flag('data-reverse-transition-active');
      return started && !flag('data-title-settled');
    };

    let nearby = true;

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          nearby = entry.isIntersecting;
          if (nearby) {
            // A settled navbar jump may publish before the clipped scrollport's
            // observer reports entry. Wake measurement before beat consumers,
            // without inventing another gesture or changing the settled offset.
            setScrollProgress(getScrollProgress(), true);
          }
          /*
           * Not while the chapter is still playing.
           *
           * This is the other half of the flick. A reader who flicks is a
           * screen past the spacer within a few frames, so the observer fires
           * and switches the overlay off -- and the beats, which are driven by
           * their own clocks and not by this, went on running correctly with
           * nothing on screen to show for it. The heading rewrote itself to an
           * empty room.
           */
          if (!nearby && overlayRef.current && !chapterBusy()) {
            // An overlay is fixed to the viewport, so one left switched on
            // covers every section after it.
            if (overlayRef.current.dataset.active !== 'false') {
              overlayRef.current.dataset.active = 'false';
            }
            publishOwnership(false);
            if (occludesWorld) setOverlayOcclusion(false);
          }
        },
        { rootMargin: '100% 0px' }
      );
      observer.observe(spacer);
    }

    const publishPosition = (overlay: HTMLElement) => {
      const rect = spacer.getBoundingClientRect();
      if (rect.height > 0) {
        writeStyleProperty(overlay, '--seq', localProgress(rect.top, rect.height, window.innerHeight).toFixed(PRECISION));
      }
    };
    // Set by a navbar jump, which settles every stage before its landing is measured.
    let landingOwed = false;

    const apply = () => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      // Hidden or not, the overlay is its stages' clock: without the landing they
      // would read the pre-jump position and unwind offscreen towards it.
      if (landingOwed) {
        landingOwed = false;
        publishPosition(overlay);
      }
      if (occludesWorld) setOverlayOcclusion(false);
      if (getProjectsView().active || isProjectsReturnOwed()) {
        writeAttribute(overlay, 'data-active', 'false');
        publishOwnership(false);
        return;
      }
      // Flat/reduced-motion Home publishes ready immediately; standalone
      // sequences with no Home keep their existing eligibility.
      const eligible = !home || home.getAttribute('data-hero-handover-settled') === 'true';
      /*
       * Keep applying through the chapter even once the spacer is behind us,
       * for the same reason the observer stops hiding it -- and keep applying
       * for as long as the overlay is still switched on, whatever else is true.
       *
       * That last clause is what guarantees the hold has a terminus. Switching
       * the overlay off was the observer's job alone, and the observer is
       * edge-triggered: it asks `chapterBusy()` once, at the instant the reader
       * crosses out of the spacer's neighbourhood, and it is never called again
       * because the intersection does not change again. A reader who leaves
       * while the chapter is mid-beat therefore leaves it switched on for good
       * -- and an overlay is fixed to the viewport, so "Education" stayed
       * painted across Skills, Projects and Contact for the rest of the page.
       *
       * Letting the frame loop see it means the ordinary path below can turn it
       * off on the next frame, which it does, because the spacer is no longer
       * overhead and nothing is owed. One frame of work to close the leak, and
       * then this returns early again and an idle frame costs nothing.
       */
      const completed = document.getElementById('about')?.getAttribute('data-title-settled') === 'true';
      if (eligible && !nearby && !chapterBusy() && !completed &&
          overlay.dataset.active !== 'true') return;

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
      /*
       * The pin is held past the spacer's end for as long as the chapter still
       * owes the reader a movement.
       *
       * Holding only while a beat is literally mid-flight is not enough, and
       * this is the bug that let a flick skip the whole thing. The beats are
       * serialised: each waits for the one before it to finish, so between them
       * there are stretches where the chain is unfinished and yet no beat is
       * running. A reader who flicks crosses the entire spacer during the first
       * of those stretches, the overlay releases because nothing is currently
       * animating, and the two remaining movements play -- correctly, on time,
       * at the right speed -- to nobody, somewhere above the fold. The reader
       * arrives in Education having never seen the chapter change.
       *
       * The same gap running backwards is why scrolling up fast dropped them
       * straight into the hero: the reverse chain had barely started when the
       * spacer left the top of the screen and took the overlay with it.
       *
       * So the test is the chain's state, not any single beat's. Something has
       * started, and the last thing has not finished. That is monotone in both
       * directions and it has a terminal state at each end -- `title-settled`
       * going down, nothing set at all coming back up -- so it cannot latch on:
       * the moment the chapter is done, the pin lets go for good.
       *
       * Note this clause does NOT require `rect.top <= 0`. That was the other
       * half of the reverse bug: a reader scrolling up is above the spacer
       * within a frame or two, and requiring the spacer to still be overhead
       * released the pin before the reverse had anything to show. The
       * IntersectionObserver above already stops this reaching beyond a screen
       * either side of the stretch.
       */
      const busy = chapterBusy();
      const pinned = eligible && ((rect.top <= 0 && rect.bottom >= rootHeight) || busy);
      // Guarded: a data attribute set to the value it already holds still
      // marks the subtree dirty, and this overlay holds the whole section.
      const active = String(pinned);
      if (overlay.dataset.active !== active) overlay.dataset.active = active;
      publishOwnership(pinned);

      /*
       * Nothing is published from a spacer that has not been laid out.
       *
       * `localProgress` answers 0 for a zero-height spacer, which is the only
       * honest answer and the wrong thing to publish: 0 is also a real position
       * -- the very top of the stretch -- and every beat downstream reads this
       * as gospel. Writing it would tell a section mid-chapter that the reader
       * had jumped back to the start.
       *
       * This became reachable when the pin started being held for the chapter
       * rather than for the spacer: the overlay can now be active while the
       * spacer is unmeasured, which before it never was.
       */
      if (rect.height <= 0) return;

      /*
       * Written only when the value actually changes.
       *
       * Every setProperty invalidates style for the subtree whether or not the
       * value differs, and this runs on every frame for the length of the
       * stretch. During a slow scroll most frames round to what was already
       * there, so most of that work is for nothing -- and a blur re-rasterises
       * on any change at all.
       */
      writeStyleProperty(overlay, '--seq', progress.toFixed(PRECISION));
      // Debt can be requested before the stage is eligible. Keep the real
      // position while hidden, otherwise a spent flick is lost when Home
      // finishes and no further scroll publication arrives to request About.
      if (!pinned) return;

      for (const layer of layers) {
        // The real position still requests beats. Their stage must not fade
        // away at either boundary while an owed movement is on screen.
        const visibleProgress = busy && (layer.name === 'head' || layer.name === 'ground')
          ? Math.min(
            layer.end - (layer.feather ?? DEFAULT_FEATHER),
            Math.max(layer.start + (layer.feather ?? DEFAULT_FEATHER), progress)
          )
          : progress;
        const presence = windowPresence(
          visibleProgress,
          layer.start,
          layer.end,
          layer.feather ?? DEFAULT_FEATHER
        );
        writeStyleProperty(overlay, `--${layer.name}-in`, presence.toFixed(PRECISION));
        writeStyleProperty(
          overlay,
          `--${layer.name}-on`,
          layerOpacity(presence).toFixed(PRECISION)
        );
      }
      if (occludesWorld) {
        setOverlayOcclusion(Number(overlay.style.getPropertyValue('--ground-in')) >= 1);
      }
    };

    apply();
    const unsubscribe = subscribeScrollProgress(apply, 'measure');
    const unsubscribeNavigation = subscribeSectionNavigation((_target, options) => {
      if (options?.source !== 'navbar') return;
      const overlay = overlayRef.current;
      if (overlay) writeAttribute(overlay, 'data-active', 'false');
      publishOwnership(false);
      if (occludesWorld) setOverlayOcclusion(false);
      landingOwed = true;
    });
    window.addEventListener('resize', apply);
    const about = document.getElementById('about');
    const completionObserver = (about || home) && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(apply)
      : null;
    if (about) {
      completionObserver?.observe(about, {
        attributes: true,
        attributeFilter: [
          'data-head-travelling',
          'data-head-pending',
          'data-head-settled',
          'data-statements-present',
          'data-statements-cleared',
          'data-bg-active',
          'data-bg-settled',
          'data-title-active',
          'data-title-settled',
          'data-reverse-transition-active',
          'data-education-returning',
        ],
      });
    }
    if (home) {
      completionObserver?.observe(home, {
        attributes: true,
        attributeFilter: ['data-hero-handover-settled'],
      });
    }

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
      unsubscribeNavigation();
      observer?.disconnect();
      completionObserver?.disconnect();
      window.removeEventListener('resize', apply);
      window.removeEventListener('scroll', apply);
      publishOwnership(false);
      if (occludesWorld) setOverlayOcclusion(false);
    };
  }, [spacer, layers, occludesWorld]);

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
            /* The handle other per-frame code finds this by. A `data-testid`
               is a test artifact, and matching one by substring -- which is
               what production code was reduced to -- cannot use any index and
               so walks every element in the document, once per frame. */
            data-pinned-sequence="true"
            data-testid={`${testId}-overlay`}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
