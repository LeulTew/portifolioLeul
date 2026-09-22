import { useCallback, useEffect, useId, useLayoutEffect, useRef, type CSSProperties } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SectionNavigate } from '@/lib/scroll/sectionNavigation';
import { EducationRecord } from './EducationRecord';
import { EDUCATION_RECORDS } from './educationRecords';
import { useRailStaged } from './useRailStaging';
import { useEducationPlayback } from './useEducationPlayback';
import { findScrollContainer, scrollContainerBy } from './scrollContainer';
import styles from './EducationRail.module.css';

/**
 * Education, read one record at a time inside a frame that draws itself open
 * when the section arrives and then carries the set right to left.
 *
 * Four things are worth knowing before changing anything here.
 *
 * The heading is owned by this component rather than by the section, because
 * it has to be held on screen with the frame -- the record set is read *under*
 * the word Education, not after it. Its resting position is the one the About
 * sequence's pixel transition hands over to, so the indent and the lead above
 * it are inherited from the section's own custom properties and must stay put.
 *
 * The page scrolls inside drei's `ScrollControls`, which translates the html
 * layer rather than scrolling it. `position: sticky` therefore never engages
 * and ScrollTrigger has nothing to bind to, so the hold is computed from the
 * rail's own rect on the scroll store's per-frame tick.
 *
 * That tick is handled synchronously, with no `requestAnimationFrame` hop. The
 * store already publishes once per frame from inside the render loop, so
 * deferring the write lands the hold one frame behind the layer it is holding
 * against -- and against a damped scroll, one frame behind reads as the frame
 * vibrating rather than as the frame being still.
 *
 * Title completion opens the stage without another gesture or stretch of scroll.
 * Once a crossing finishes, a fresh wave or control click can select one record.
 */
export function EducationRail({ onNavigate }: { onNavigate?: SectionNavigate } = {}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const previousRef = useRef<HTMLButtonElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const initiatingControlRef = useRef<HTMLButtonElement | null>(null);

  const stageRef = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const staged = useRailStaged();

  const total = EDUCATION_RECORDS.length;
  const { active, phase, ready, step } = useEducationPlayback({
    rail: railRef,
    stage: stageRef,
    pinned: pinnedRef,
    frame: frameRef,
    head: headRef,
    track: trackRef,
  }, staged, total, onNavigate);

  useEffect(() => {
    const movedFocus = (event: FocusEvent) => {
      if (event.target !== document.body && event.target !== initiatingControlRef.current) {
        initiatingControlRef.current = null;
      }
    };
    const pointedElsewhere = (event: PointerEvent) => {
      if (event.target instanceof Node && !initiatingControlRef.current?.contains(event.target)) {
        initiatingControlRef.current = null;
      }
    };
    document.addEventListener('focusin', movedFocus);
    document.addEventListener('pointerdown', pointedElsewhere);
    return () => {
      document.removeEventListener('focusin', movedFocus);
      document.removeEventListener('pointerdown', pointedElsewhere);
    };
  }, []);

  useLayoutEffect(() => {
    if (!staged || phase === 'outside' || phase === 'closing') {
      initiatingControlRef.current = null;
      return;
    }
    if (!ready) return;
    const control = initiatingControlRef.current;
    initiatingControlRef.current = null;
    if (!control?.isConnected ||
        (document.activeElement !== document.body && document.activeElement !== control)) return;
    const target = control.disabled
      ? control === nextRef.current ? previousRef.current : nextRef.current
      : control;
    if (target && !target.disabled) target.focus({ preventScroll: true });
  }, [phase, ready, staged]);

  const stepFromControl = (direction: -1 | 1, control: HTMLButtonElement) => {
    // Native disabling can drop focus to body before the next committed render.
    initiatingControlRef.current = staged && ready && document.activeElement === control ? control : null;
    step(direction);
  };

  /*
   * Controls and the artwork's hover surfaces take pointer events,
   * and taking them means taking the wheel too. The stage is fixed and
   * portalled out of the scroll container, so a wheel event landing on a
   * button has nowhere to bubble to and the page simply stops -- so it is
   * handed on by hand.
   */
  const forwardWheel = useCallback((event: React.WheelEvent) => {
    if (!staged) return;
    const rail = railRef.current;
    if (!rail) return;
    scrollContainerBy(findScrollContainer(rail), event.deltaY);
  }, [staged]);

  const activeRecord = EDUCATION_RECORDS[active] ?? EDUCATION_RECORDS[0];

  /*
   * The held stage.
   *
   * Portalled to the body and fixed, which is the only way to be held still on
   * this page. `position: fixed` resolves against the nearest transformed
   * ancestor, and every section here lives inside drei's `Scroll html`, which
   * is positioned by a transform -- so a fixed child of this section would ride
   * the scroll like everything else. Portalling it out is what makes the
   * browser hold it, rather than this component holding it by arithmetic a
   * frame behind. See `PinnedSequence`, which is held for the same reason.
   */
  const stage = (
    <section
      ref={stageRef}
      className={styles.stage}
      data-testid="education-stage"
      data-phase={phase}
      data-active-record={active}
      aria-labelledby={headingId}
      aria-busy={staged && phase !== 'reading' && phase !== 'outside'}
      /* Set here as well as on the rail: the stage is portalled to the body,
         so it inherits nothing from the section the rail lives in, and the
         track is sized in records. */
      style={{ '--count': total } as CSSProperties}
    >
      <div ref={pinnedRef} className={styles.pinned}>
        {/*
          The heading the About sequence's pixel transition hands over to. It
          starts exactly where that transition leaves it and only moves once
          the frame below it opens.
        */}
        <div ref={headRef} className={styles.head} data-testid="education-sticky-header">
          <h2 id={headingId} className={styles.headTitle}>Education</h2>
          <p className={styles.headSubtitle}>Academic Foundations &amp; Industry Certifications</p>
        </div>

        <div className={styles.frameHold}>
          <div ref={frameRef} className={styles.frame} data-testid="education-frame">
            <span
              className={`${styles.edge} ${styles.edgeH} ${styles.edgeTop}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.edge} ${styles.edgeH} ${styles.edgeBottom}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.edge} ${styles.edgeV} ${styles.edgeLeft}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.edge} ${styles.edgeV} ${styles.edgeRight}`}
              aria-hidden="true"
            />

            <div className={`${styles.canvas} ${styles.opening}`}>
              <div className={styles.viewport}>
                <div ref={trackRef} className={styles.track} data-testid="education-track">
                  {EDUCATION_RECORDS.map((record, index) => (
                    <EducationRecord
                      key={record.id}
                      record={record}
                      position={index}
                      onWheel={forwardWheel}
                      inactive={staged && index !== active}
                      interactive={staged && phase === 'reading' && index === active}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.controls} onWheel={forwardWheel}>
                <button
                  ref={previousRef}
                  type="button"
                  className={styles.control}
                  onClick={event => stepFromControl(-1, event.currentTarget)}
                  disabled={active === 0 || (staged && !ready)}
                  aria-label="Previous record"
                >
                  <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
                </button>

                {/* Where the reader is in the set, drawn rather than counted. */}
                <ol className={styles.progress} data-testid="education-progress">
                  {EDUCATION_RECORDS.map((record, index) => (
                    <li
                      key={record.id}
                      className={styles.progressTick}
                      data-on={index <= active ? 'true' : undefined}
                      aria-current={index === active ? 'true' : undefined}
                    />
                  ))}
                </ol>

                <p className={styles.nowReading} aria-live="polite">
                  {activeRecord.title}
                </p>

                <button
                  ref={nextRef}
                  type="button"
                  className={styles.control}
                  onClick={event => stepFromControl(1, event.currentTarget)}
                  disabled={active === total - 1 || (staged && !ready)}
                  aria-label="Next record"
                >
                  <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div
      ref={railRef}
      className={styles.rail}
      data-testid="education-rail"
      data-staged={staged ? 'true' : undefined}
      style={{ '--count': total } as CSSProperties}
    >
      {/*
        Portalled on the first render rather than after a mount tick. Swapping
        the tree afterwards would tear down every node in it and build it again
        somewhere else, and the effects above hold refs to those nodes -- they
        would be left pointing at a detached frame that never opens.
      */}
      {staged && typeof document !== 'undefined'
        ? createPortal(stage, document.body)
        : stage}
    </div>
  );
}
