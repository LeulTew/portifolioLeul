import gsap from 'gsap';
import { trackOffset } from './railTransit';
import styles from './EducationRail.module.css';

export function openingTimeline(
  head: HTMLElement,
  complete: () => void,
  returned: () => void
): gsap.core.Timeline {
  return gsap.timeline({
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
}

export function recordTimeline(
  track: HTMLElement,
  index: number,
  total: number,
  complete: () => void
): gsap.core.Timeline {
  const arriving = track.querySelector<HTMLElement>(`[data-record="${index}"]`);
  if (!arriving) throw new Error(`Education record ${index} is not mounted`);
  const timeline = gsap.timeline({ paused: true, onComplete: complete })
    .to(track, {
      xPercent: trackOffset(index, total),
      duration: 1.15,
      ease: 'power4.inOut',
    });

  const sealDisc = arriving.querySelector<HTMLElement>(`.${styles.sealDisc}`);
  const sealRing = arriving.querySelector<HTMLElement>(`.${styles.sealRing}`);
  if (sealDisc) {
    timeline.fromTo(sealDisc, { opacity: 0, scale: 0.82, rotate: -24 },
      { opacity: 1, scale: 1, rotate: 0, duration: 1.15, ease: 'back.out(1.2)' }, 0.22);
  }
  if (sealRing) {
    timeline.fromTo(sealRing, { opacity: 0, scale: 0.9, rotate: 36 },
      { opacity: 1, scale: 1, rotate: 0, duration: 1.3, ease: 'expo.out' }, 0.26);
  }
  const reveal = arriving.querySelector(`.${styles.markReveal}`);
  const rim = arriving.querySelector(`.${styles.markRim}`);
  if (reveal && rim) {
    timeline
      .fromTo(reveal, { attr: { r: 0 } }, { attr: { r: 172 }, duration: 1.25, ease: 'expo.out' }, 0.24)
      .fromTo(rim, { strokeDasharray: 1, strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1.35, ease: 'expo.out' }, 0.24);
  }
  return timeline
    .fromTo(arriving.querySelectorAll('[data-part="kind"]'), { opacity: 0, x: 14 },
      { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' }, 0.28)
    .fromTo(arriving.querySelectorAll('[data-part="title"]'), { yPercent: 108 },
      { yPercent: 0, duration: 1.05, ease: 'expo.out' }, 0.34)
    .fromTo(arriving.querySelectorAll('[data-part="row"]'), { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out', stagger: 0.045 }, 0.44);
}
