import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { HilcoeMark } from './HilcoeMark';
import { EDUCATION_RECORDS, type EducationRecord } from './educationRecords';
import {
  pinOffset,
  pinProgress,
  recordAt,
  recordWindow,
  releaseOffset,
  stageVisible,
  stepDistance,
  trackOffset,
} from './railTransit';
import { useRailStaged } from './useRailStaging';
import { findScrollContainer, scrollContainerBy } from './scrollContainer';
import styles from './EducationRail.module.css';

/** Past this many, the list reads as a wall and is set in two columns. */
const DENSE_ITEMS = 6;

/**
 * How far the rail's top has to have climbed for the section to count as
 * having taken the screen. Zero is the line the pin itself engages on.
 */
const OPEN_LINE = 0;

function Record({
  record,
  position,
  onWheel,
}: {
  record: EducationRecord;
  position: number;
  /** Hands the wheel back to the page; see `forwardWheel`. */
  onWheel: (event: React.WheelEvent) => void;
}) {
  return (
    <article
      className={styles.record}
      data-record={position}
      data-has-mark={record.logo ? 'true' : undefined}
      aria-label={`${record.kind}: ${record.title}`}
    >
      <div className={styles.plate}>
        <div className={styles.plateHead}>
          <span className={styles.kind} data-part="kind">
            {record.kind}
          </span>
          {/* Uncovered from behind its own edge rather than faded in, so the
              title reads as typeset on arrival instead of switched on. */}
          <h3 className={styles.recordTitle}>
            <span className={styles.recordTitleInner} data-part="title">
              {record.title}
            </span>
          </h3>
        </div>
        <dl className={styles.spec}>
          <div className={styles.specRow} data-part="row">
            <dt className={styles.specKey}>Award</dt>
            <dd className={styles.specValue}>{record.award}</dd>
          </div>
          <div className={styles.specRow} data-part="row">
            <dt className={styles.specKey}>Completed</dt>
            <dd className={`${styles.specValue} ${styles.mono}`}>{record.period}</dd>
          </div>
        </dl>
      </div>

      <div className={styles.detail}>
        {record.summary ? (
          <p className={styles.summary} data-part="row">
            {record.summary}
          </p>
        ) : null}
        <ul className={styles.items} data-dense={record.items.length > DENSE_ITEMS || undefined}>
          {record.items.map((item) => (
            <li key={item} className={styles.item} data-part="row">
              <span className={styles.itemRule} aria-hidden="true" />
              <span className={styles.itemText}>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Only where the real artwork exists. No placeholder for the rest. */}
      {record.logo === 'hilcoe' ? (
        <div className={styles.mark} onWheel={onWheel}>
          <HilcoeMark className={styles.markArt} />
        </div>
      ) : null}
    </article>
  );
}

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
 * Scroll picks the record; it does not drag the track. The crossing is a fixed
 * timeline, so a flick and a slow scroll produce exactly the same animation --
 * which is the difference between a designed transition and a scrub.
 */
export function EducationRail() {
  const railRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const openCtxRef = useRef<gsap.Context | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const staged = useRailStaged();

  const total = EDUCATION_RECORDS.length;

  /*
   * The hold, the opening, and the record being read -- all off one tick,
   * because all three are answers to the same question: where is the rail.
   */
  useEffect(() => {
    if (!staged) return;

    const rail = railRef.current;
    const pinned = pinnedRef.current;
    const stage = stageRef.current;
    const frame = frameRef.current;
    const head = headRef.current;
    if (!rail || !pinned || !stage || !frame || !head) return;

    let openTimeline: gsap.core.Timeline | null = null;

    /*
     * The opening and closing timeline.
     *
     * Bidirectional and replayable:
     * - When entering Education (rect.top <= OPEN_LINE): heading eases down in scale
     *   and up towards the corner, horizontal and vertical edges draw out, and inner contents fade up.
     * - When scrolling back up into About (rect.top > OPEN_LINE): the frame collapses and the
     *   heading expands back to its full resting size, replaying in reverse cleanly every time.
     */
    openCtxRef.current = gsap.context(() => {
      openTimeline = gsap
        .timeline({
          paused: true,
          defaults: { ease: 'power2.inOut' },
          onReverseComplete: () => {
            head.removeAttribute('data-settled');
            frame.removeAttribute('data-open');
            const r = rail.getBoundingClientRect();
            if (r.top > OPEN_LINE) {
              stage.removeAttribute('data-visible');
              const aboutEl = rail.closest('#about') || document.getElementById('about');
              aboutEl?.removeAttribute('data-education-active');
            }
          },
        })
        .to(head, {
          scale: 0.72,
          x: '-0.5rem',
          y: '-1.5rem',
          duration: 0.85,
        }, 0)
        .fromTo(
          `.${styles.edgeH}`,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.75, stagger: 0.04 },
          0.06
        )
        .fromTo(
          `.${styles.edgeV}`,
          { scaleY: 0 },
          { scaleY: 1, duration: 0.65, stagger: 0.04 },
          0.18
        )
        .fromTo(
          `.${styles.opening}`,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.55, stagger: 0.05 },
          0.32
        );
    }, pinned);

    const apply = () => {
      const rect = rail.getBoundingClientRect();
      const frameHeight = pinned.offsetHeight;
      const pin = pinOffset(rect.top, rect.height, frameHeight);

      /*
       * Zero for the whole hold. The frame is held by the browser, not by
       * arithmetic: offsetting a fixed overlay to chase a layer that is itself
       * being translated puts the two a frame apart, and a frame apart on a
       * damped scroll is exactly the vibration this replaced.
       */
      stage.style.setProperty('--release', `${releaseOffset(rect.top, rect.height, frameHeight)}px`);

      // Bidirectional animation trigger
      const aboutEl = rail.closest('#about') || (typeof document !== 'undefined' ? document.getElementById('about') : null);
      const isTitleSettled = aboutEl?.getAttribute('data-title-settled') === 'true';
      const isTransitionActive =
        aboutEl?.getAttribute('data-title-active') === 'true' ||
        aboutEl?.getAttribute('data-bg-active') === 'true';

      const canOpen = isTitleSettled || !isTransitionActive;
      const shouldOpen = rect.top <= OPEN_LINE && canOpen;

      if (shouldOpen) {
        if (openTimeline && (openTimeline.reversed() || openTimeline.progress() < 1)) {
          head.setAttribute('data-settled', 'true');
          frame.setAttribute('data-open', 'true');
          openTimeline.play();
        }
      } else {
        // Scrolling back up into About: reverse timeline and restore heading size
        if (openTimeline && (!openTimeline.reversed() || openTimeline.progress() > 0)) {
          openTimeline.reverse();
        }
      }

      const pastEnd = releaseOffset(rect.top, rect.height, frameHeight) >= frameHeight;
      const isReversingToAbout = rect.top > OPEN_LINE && (openTimeline ? openTimeline.progress() > 0.005 : false);
      const visible = !pastEnd && ((stageVisible(rect.top, rect.height, frameHeight) && canOpen) || isReversingToAbout);

      if (visible) {
        stage.setAttribute('data-visible', 'true');
        aboutEl?.setAttribute('data-education-active', 'true');
      } else {
        stage.removeAttribute('data-visible');
        aboutEl?.removeAttribute('data-education-active');
      }

      const progress = recordWindow(pinProgress(pin, rect.height, frameHeight));
      const next = recordAt(progress, total);
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
      }
    };

    apply();
    const unsubscribe = subscribeScrollProgress(apply);
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);

    return () => {
      unsubscribe();
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      const aboutEl = rail.closest('#about') || document.getElementById('about');
      aboutEl?.removeAttribute('data-education-active');
      openCtxRef.current?.revert();
      openCtxRef.current = null;
    };
  }, [staged, total]);

  /*
   * The crossing.
   *
   * Not a slide. The track carries the record into place while that record's
   * own contents are laid out on arrival: the label arrives, the title is
   * uncovered from behind its edge, and the rows come up under it in order.
   * What the reader sees is a record being set, not a panel going past.
   *
   * One timeline, one set of durations, whatever the scroll did to get here.
   */
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !staged) return;

    const ctx = gsap.context(() => {
      const arriving = track.querySelector<HTMLElement>(`[data-record="${active}"]`);
      const timeline = gsap.timeline();

      timeline.to(track, {
        xPercent: trackOffset(active, total),
        duration: 1.15,
        // Leaves and lands at rest, with the speed in the middle. A plain
        // ease-out starts at full pace, which is what makes a carousel read as
        // a jump rather than as travel.
        ease: 'power4.inOut',
      });

      if (!arriving) return;

      /*
       * The badge, where the record has one, is uncovered from its centre
       * while its rim draws round it. The artwork itself never moves or
       * scales: it is someone else's identity, and animating its geometry
       * would be redrawing it. Guarded rather than run against an empty
       * selection, so the records with no artwork stay silent.
       */
      const reveal = arriving.querySelector(`.${styles.markReveal}`);
      const rim = arriving.querySelector(`.${styles.markRim}`);
      if (reveal && rim) {
        timeline
          .fromTo(reveal, { attr: { r: 0 } }, { attr: { r: 172 }, duration: 1.25, ease: 'expo.out' }, 0.24)
          .fromTo(
            rim,
            { strokeDasharray: 1, strokeDashoffset: 1 },
            { strokeDashoffset: 0, duration: 1.35, ease: 'expo.out' },
            0.24
          );
      }

      timeline
        .fromTo(
          arriving.querySelectorAll('[data-part="kind"]'),
          { opacity: 0, x: 14 },
          { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' },
          0.28
        )
        .fromTo(
          arriving.querySelectorAll('[data-part="title"]'),
          { yPercent: 108 },
          { yPercent: 0, duration: 1.05, ease: 'expo.out' },
          0.34
        )
        .fromTo(
          arriving.querySelectorAll('[data-part="row"]'),
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out', stagger: 0.045 },
          0.44
        );
    }, track);

    return () => {
      /*
       * Killed, not reverted.
       *
       * `revert()` puts every value back to where it was when the context was
       * created -- which for an interrupted crossing means snapping the track
       * back to the record it was leaving, and starting the next crossing from
       * there. Scroll fast enough to change record mid-crossing and the track
       * ends up parked between two records, showing half of each. Killing
       * leaves the track where it actually is, so the next crossing picks it
       * up and carries it the rest of the way.
       */
      ctx.kill();
    };
  }, [active, total, staged]);

  /*
   * Nothing is held, drawn or crossed on a narrow screen, or for a reader who
   * asked for less motion. Everything is simply already open and laid out.
   */
  useEffect(() => {
    if (staged) return;
    frameRef.current?.setAttribute('data-open', 'true');
    headRef.current?.setAttribute('data-settled', 'true');
  }, [staged]);

  /*
   * The controls are the only thing on the stage that takes pointer events,
   * and taking them means taking the wheel too. The stage is fixed and
   * portalled out of the scroll container, so a wheel event landing on a
   * button has nowhere to bubble to and the page simply stops -- so it is
   * handed on by hand.
   */
  const forwardWheel = useCallback((event: React.WheelEvent) => {
    const rail = railRef.current;
    if (!rail) return;
    scrollContainerBy(findScrollContainer(rail), event.deltaY, false);
  }, []);

  /* Prev and next spend the scroll a record costs, so the two stay in step. */
  const step = useCallback(
    (direction: -1 | 1) => {
      const rail = railRef.current;
      const pinned = pinnedRef.current;
      if (!rail || !pinned) return;

      const distance = stepDistance(rail.offsetHeight, pinned.offsetHeight, total);
      if (distance <= 0) return;

      scrollContainerBy(findScrollContainer(rail), direction * distance);
    },
    [total]
  );

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
    <div
      ref={stageRef}
      className={styles.stage}
      data-testid="education-stage"
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
          <h2 className={styles.headTitle}>Education</h2>
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

            <div className={`${styles.viewport} ${styles.opening}`}>
              <div ref={trackRef} className={styles.track} data-testid="education-track">
                {EDUCATION_RECORDS.map((record, index) => (
                  <Record
                    key={record.id}
                    record={record}
                    position={index}
                    onWheel={forwardWheel}
                  />
                ))}
              </div>
            </div>

            <div className={`${styles.controls} ${styles.opening}`} onWheel={forwardWheel}>
              <button
                type="button"
                className={styles.control}
                onClick={() => step(-1)}
                disabled={active === 0}
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
                type="button"
                className={styles.control}
                onClick={() => step(1)}
                disabled={active === total - 1}
                aria-label="Next record"
              >
                <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
