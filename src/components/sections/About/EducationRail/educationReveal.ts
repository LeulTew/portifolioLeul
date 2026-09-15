import { createTimeline, stagger, steps } from 'animejs';
import { prepareTextFrames } from './educationTextFrames';
import {
  EDUCATION_TEXT_PROFILES, educationTextParts, educationTextStyle, type EducationTextPart,
} from './educationTextProfiles';
import styles from './EducationRail.module.css';

export const EDUCATION_REVEAL_MS = 1000;
export const EDUCATION_SCAN_STEPS = 8;
const scanEase = steps(EDUCATION_SCAN_STEPS);

function addTextMotion(
  timeline: ReturnType<typeof createTimeline>,
  { element, motion, start, end }: EducationTextPart,
  direction: -1 | 1
) {
  if (motion === 'scan') {
    // One stationary terminal shutter, not staggered word ink or assembly travel.
    timeline.add(element, {
      clipPath: [direction > 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)', 'inset(0% 0% 0% 0%)'],
      duration: end - start, ease: scanEase,
    }, start);
    return;
  }

  if (motion === 'type' || motion === 'decrypt' || motion === 'count') {
    timeline.add(element, {
      opacity: [0, 1],
      translateY: [motion === 'count' ? 10 * direction : 0, 0],
      duration: 120,
    }, start);
    return;
  }

  const words = Array.from(element.querySelectorAll<HTMLElement>('[data-edu-word]'));
  if (!words.length) throw new Error(`Education ${motion} text is missing its word units`);
  if (direction < 0) words.reverse();
  const spread = words.length > 1 ? 90 : 0;
  const duration = end - start - spread;
  const common = {
    opacity: [0, 1],
    duration,
    ease: 'outCubic' as const,
    delay: stagger([0, spread], { from: motion === 'press' ? 'center' : 'first' }),
  };

  switch (motion) {
    case 'fold':
      timeline.add(words, {
        ...common, rotateX: [-76 * direction, 0], translateY: [16 * direction, 0],
      }, start);
      break;
    case 'wipe':
      timeline.add(words, {
        ...common,
        clipPath: [direction > 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)', 'inset(0% 0% 0% 0%)'],
        translateX: [-8 * direction, 0],
      }, start);
      break;
    case 'slide':
      timeline.add(words, {
        ...common, translateX: [-34 * direction, 0], skewX: [8 * direction, 0],
      }, start);
      break;
    case 'press':
      timeline.add(words, {
        ...common, scale: [1.25, 1], rotateZ: [-3.5 * direction, 0], translateY: [-8 * direction, 0],
      }, start);
      break;
    case 'wave':
      timeline.add(words, {
        ...common,
        translateY: (_target: unknown, index = 0) => [(index % 2 ? -22 : 26) * direction, 0],
        rotateZ: (_target: unknown, index = 0) => [(index % 2 ? 7 : -7) * direction, 0],
        scale: [0.84, 1],
      }, start);
      break;
    case 'blur': {
      const first = Math.round(duration * 0.62);
      timeline.add(element, {
        filter: ['blur(3px)', 'blur(0px)'], duration: end - start, ease: 'outQuad',
      }, start);
      timeline.add(words, {
        keyframes: [
          { translateY: [18 * direction, -3 * direction], opacity: [0, 0.65], duration: first },
          { translateY: 0, opacity: 1, duration: duration - first },
        ],
        delay: common.delay, ease: 'outCubic',
      }, start);
      break;
    }
  }
}

/** Paused deliberately: the chapter's single clock owns every arrival and return. */
export function createEducationReveal(record: HTMLElement, direction: -1 | 1 = 1) {
  const timeline = createTimeline({
    autoplay: false,
    composition: false,
    defaults: { ease: 'outExpo', composition: 'none' },
  });
  const glyphs = record.querySelectorAll<HTMLElement>('[data-edu-glyph]');
  const textStyle = educationTextStyle(record.dataset.textStyle);
  const titleMotion = EDUCATION_TEXT_PROFILES[textStyle].title;
  const title = titleMotion === 'decrypt' ? [] : Array.from(
    glyphs.length ? glyphs : record.querySelectorAll<HTMLElement>('[data-part="title"]')
  );
  const rows = record.querySelectorAll<HTMLElement>('[data-part="row"]');
  const textParts = educationTextParts(record);
  const textFrames = prepareTextFrames(textParts, direction);
  if (direction < 0) title.reverse();

  timeline.add({ duration: EDUCATION_REVEAL_MS }, 0);
  if (title.length) {
    if (titleMotion === 'press') {
      timeline.add(title, {
        translateY: [-16 * direction, 0], rotateZ: [4 * direction, 0], scale: [1.22, 1],
        opacity: [0, 1], duration: 430, ease: 'outCubic',
        delay: stagger([0, 150], { from: 'center' }),
      }, 420);
    } else if (titleMotion === 'wave') {
      timeline.add(title, {
        translateY: (_target: unknown, index = 0) => [(index % 2 ? -30 : 34) * direction, 0],
        rotateZ: (_target: unknown, index = 0) => [(index % 2 ? 12 : -12) * direction, 0],
        scale: [0.72, 1], opacity: [0, 1], duration: 430, ease: 'outCubic',
        delay: stagger([0, 170]),
      }, 400);
    } else {
      timeline.add(title, {
        translateY: [`${112 * direction}%`, '0%'],
        rotateX: [-82 * direction, 0], rotateZ: [-4 * direction, 0],
        opacity: [0, 1], duration: 410, ease: 'outCubic', delay: stagger([0, 170]),
      }, 420);
    }
  }
  timeline.add(record.querySelectorAll('[data-part="kind"]'), {
    opacity: [0, 1], duration: 200,
  }, 250);
  timeline.add(rows, {
    opacity: [0, 1], duration: 160, delay: stagger([0, 90]),
  }, 250);

  textParts.forEach(part => addTextMotion(timeline, part, direction));

  const brands = record.querySelectorAll('[data-edu-brand]');
  if (brands.length) timeline.add(brands, {
    translateY: [8, 0], opacity: [0, 1], duration: 360,
  }, 640);
  const diagrams = record.querySelectorAll('[data-edu-diagram]');
  if (diagrams.length) timeline.add(diagrams, {
    translateY: [12, 0], opacity: [0, 1], duration: 450,
  }, 400);
  const drawing = record.querySelectorAll('[data-edu-draw]');
  if (drawing.length) timeline.add(drawing, {
    strokeDasharray: [1, 1], strokeDashoffset: [1, 0],
    duration: 580, delay: stagger([0, 100]),
  }, 320);

  const artwork = record.querySelectorAll('[data-edu-art]');
  if (artwork.length) timeline.add(artwork, {
    translateY: [36, 0], rotateY: [-18 * direction, 0], rotateZ: [-8 * direction, 0],
    scale: [0.84, 1], opacity: [0, 1], duration: 830,
  }, 170);
  const rules = record.querySelectorAll('[data-edu-rule]');
  if (rules.length) timeline.add(rules, {
    scaleX: [0, 1], duration: 620, delay: stagger([0, 100]),
  }, 250);
  const pieces = record.querySelectorAll('[data-edu-piece]');
  if (pieces.length) timeline.add(pieces, {
    translateY: [-24, 0], rotateZ: [12 * direction, 0], opacity: [0, 1],
    duration: 650, delay: stagger([0, 180]),
  }, 170);

  const disc = record.querySelector(`.${styles.sealDiscMotion}`);
  const ring = record.querySelector(`.${styles.sealRingMotion}`);
  if (disc) timeline.add(disc, {
    rotateZ: [-24 * direction, 0], scale: [0.82, 1], opacity: [0, 1],
    duration: 820, ease: 'outBack(1.2)',
  }, 180);
  if (ring) timeline.add(ring, {
    rotateZ: [36 * direction, 0], scale: [0.9, 1], opacity: [0, 1], duration: 800,
  }, 200);
  const reveal = record.querySelector(`.${styles.markReveal}`);
  const rim = record.querySelector(`.${styles.markRim}`);
  if (reveal) timeline.add(reveal, { r: [0, 172], duration: 820 }, 180);
  if (rim) timeline.add(rim, {
    strokeDasharray: [1, 1], strokeDashoffset: [1, 0], duration: 820,
  }, 180);
  // Every target has explicit endpoints; assemble first, then render once.
  timeline.init();
  textFrames.seek(0);
  let paintedFrame = -1;
  return {
    get duration() { return timeline.duration; },
    get composition() { return timeline.composition; },
    get paused() { return timeline.paused; },
    get progress() { return timeline.progress; },
    seek(time: number, muteCallbacks = true) {
      const frame = Math.floor(time * 60 / EDUCATION_REVEAL_MS);
      if (frame === paintedFrame && time !== 0 && time !== EDUCATION_REVEAL_MS) return;
      paintedFrame = frame;
      timeline.seek(time, muteCallbacks);
      textFrames.seek(time);
    },
    revert() {
      textFrames.revert();
      timeline.revert();
    },
  };
}
