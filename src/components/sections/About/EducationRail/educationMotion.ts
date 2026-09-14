import gsap from 'gsap';
import { trackOffset } from './railTransit';
import styles from './EducationRail.module.css';

type PaintReveal = (progress: number) => void;

export function openingTimeline(
  head: HTMLElement,
  complete: () => void,
  returned: () => void,
  paintReveal: PaintReveal
): gsap.core.Timeline {
  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: 'power2.inOut' },
    onComplete: complete,
    onReverseComplete: returned,
  })
    .to(head, { scale: 0.72, x: '-0.5rem', y: '-1.5rem', duration: 0.85 }, 0)
    .fromTo(`.${styles.edgeH}`, { scaleX: 0 },
      { scaleX: 1, duration: 0.75, stagger: 0.04 }, 0.06)
    .fromTo(`.${styles.edgeV}`, { scaleY: 0 },
      { scaleY: 1, duration: 0.65, stagger: 0.04 }, 0.18)
    .fromTo(`.${styles.opening}`, { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.55, stagger: 0.05 }, 0.32);
  return timeline.eventCallback('onUpdate', () => paintReveal(timeline.progress()));
}

export function recordTimeline(
  track: HTMLElement,
  index: number,
  total: number,
  complete: () => void,
  paintReveal: PaintReveal
): gsap.core.Timeline {
  const timeline = gsap.timeline({ paused: true, onComplete: complete })
    .to(track, {
      xPercent: trackOffset(index, total),
      duration: 1,
      ease: 'power4.inOut',
    });

  return timeline.eventCallback('onUpdate', () => paintReveal(timeline.progress()));
}
