import { createTimeline, stagger } from 'animejs';
import { prepareDecryptedText } from './educationDecryption';
import styles from './EducationRail.module.css';

export const EDUCATION_REVEAL_MS = 1000;

/** Paused deliberately: the chapter's single clock owns every arrival and return. */
export function createEducationReveal(record: HTMLElement, direction: -1 | 1 = 1) {
  const timeline = createTimeline({
    autoplay: false,
    composition: false,
    defaults: { ease: 'outExpo', composition: 'none' },
  });
  const glyphs = record.querySelectorAll<HTMLElement>('[data-edu-glyph]');
  const textStyle = record.dataset.textStyle ?? 'fold';
  const title = textStyle === 'decode' ? [] : Array.from(
    glyphs.length ? glyphs : record.querySelectorAll<HTMLElement>('[data-part="title"]')
  );
  const rows = record.querySelectorAll<HTMLElement>('[data-part="row"]');
  const decryption = prepareDecryptedText(record, direction);
  if (direction < 0) title.reverse();

  timeline.add({ duration: EDUCATION_REVEAL_MS }, 0);
  if (title.length) timeline.add(title, {
    translateY: textStyle === 'flow' ? [24 * direction, 0] : [`${112 * direction}%`, '0%'],
    translateX: textStyle === 'flow' ? [-24 * direction, 0] : [0, 0],
    rotateX: [textStyle === 'fold' ? -82 * direction : 0, 0],
    rotateZ: [(textStyle === 'flow' ? 8 : textStyle === 'letterpress' ? -2 : -4) * direction, 0],
    scale: [textStyle === 'letterpress' ? 0.9 : 1, 1],
    opacity: [0, 1],
    duration: 410,
    ease: 'outCubic',
    delay: stagger([0, 170]),
  }, 420);
  timeline.add(record.querySelectorAll('[data-part="kind"]'), {
    opacity: [0, 1], duration: 200,
  }, 250);
  timeline.add(rows, {
    opacity: [0, 1], duration: 160, delay: stagger([0, 90]),
  }, 250);

  const phrases = Array.from(record.querySelectorAll<HTMLElement>('[data-edu-text="blur"]'));
  phrases.forEach((phrase, index) => {
    const words = Array.from(phrase.querySelectorAll<HTMLElement>('[data-edu-word]'));
    if (direction < 0) words.reverse();
    const start = 380 + (phrases.length > 1 ? index / (phrases.length - 1) * 110 : 0);
    // BlurText's overshoot/resolve keyframes, with one small filter per phrase
    // instead of a separate filtered surface for every word.
    timeline.add(phrase, {
      filter: ['blur(3px)', 'blur(0px)'], duration: 420, ease: 'outQuad',
    }, start);
    timeline.add(words, {
      keyframes: [
        { translateY: [18 * direction, -3 * direction], opacity: [0, 0.65], duration: 260 },
        { translateY: 0, opacity: 1, duration: 160 },
      ],
      delay: stagger([0, 90]), ease: 'outCubic',
    }, start);
  });

  const brands = record.querySelectorAll('[data-edu-brand]');
  if (brands.length) timeline.add(brands, {
    translateY: [8, 0], opacity: [0, 1], duration: 360,
  }, 640);
  if (brands.length) {
    timeline.add(record.querySelectorAll('[data-edu-brand-color]'), {
      opacity: [0, 1], duration: 240,
    }, 760);
    timeline.add(record.querySelectorAll('[data-edu-brand-white]'), {
      opacity: [1, 0], duration: 240,
    }, 760);
  }
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
  decryption.seek(0);
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
      decryption.seek(time);
    },
    revert() {
      decryption.revert();
      timeline.revert();
    },
  };
}
