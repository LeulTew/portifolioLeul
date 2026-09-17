import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { phaseFrameDelta } from '@/lib/motion/triggeredPhase';

export const CRT_POWER_ON_MS = 640;

function clearPaint(elements: readonly Element[]): void {
  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;
    element.style.removeProperty('transform');
    element.style.removeProperty('opacity');
    element.style.removeProperty('clip-path');
  }
}

/** Only visible animation time advances; retargeting disposes the old score. */
function playVisible(timeline: gsap.core.Timeline, finish: () => void): () => void {
  let frame = 0;
  let last = performance.now();
  let alive = true;
  let finished = false;
  const wake = () => {
    if (!frame && alive && !finished && !document.hidden) frame = requestAnimationFrame(tick);
  };
  function tick(now: number) {
    frame = 0;
    if (!alive || document.hidden) return;
    const time = Math.min(timeline.duration(), timeline.time() + phaseFrameDelta(now - last) / 1000);
    last = now;
    timeline.time(time, true);
    if (time >= timeline.duration()) {
      finished = true;
      finish();
    } else wake();
  }
  const visibility = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = performance.now();
    wake();
  };
  document.addEventListener('visibilitychange', visibility);
  wake();
  return () => {
    alive = false;
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', visibility);
  };
}

export function useProjectBroadcast(
  ref: RefObject<HTMLDivElement>,
  selection: number,
  enabled: boolean,
  reduced: boolean,
  details: boolean,
): void {
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host || !enabled || reduced || details) return;
    let stop = () => {};
    const context = gsap.context(() => {
      const image = host.querySelector('[data-broadcast-image]');
      const title = host.querySelector('[data-broadcast-title]');
      const copy = host.querySelectorAll('[data-broadcast-copy]');
      const signal = host.querySelector('[data-broadcast-signal]');
      const moving = [image, title, ...copy].filter((node): node is Element => node !== null);
      const score = gsap.timeline({ paused: true });
      if (image) score.fromTo(image, { opacity: 0.45, clipPath: 'inset(0 0 100% 0)' }, {
        opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 0.28, ease: 'power2.out',
      }, 0);
      if (title) score.fromTo(title, { yPercent: 22, opacity: 0.45 }, {
        yPercent: 0, opacity: 1, duration: 0.26, ease: 'power3.out',
      }, 0.025);
      if (copy.length) score.fromTo(copy, { y: 6, opacity: 0.45 }, {
        y: 0, opacity: 1, duration: 0.22, stagger: { amount: 0.055 }, ease: 'power2.out',
      }, 0.04);
      if (signal) score.fromTo(signal, { scaleY: 1, opacity: 0.2 }, {
        scaleY: 0, opacity: 0, duration: 0.25, ease: 'power2.out',
      }, 0);
      stop = playVisible(score, () => {
        clearPaint(moving);
        if (signal) clearPaint([signal]);
      });
    }, host);
    return () => { stop(); context.revert(); };
  }, [ref, selection, enabled, reduced, details]);
}

export function useCRTPowerOn(
  ref: RefObject<HTMLDivElement>, powered: boolean, reduced: boolean,
): void {
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host || !powered || reduced) return;
    let stop = () => {};
    const context = gsap.context(() => {
      const shutter = host.querySelector('[data-crt-shutter]');
      const beam = host.querySelector('[data-crt-beam]');
      const raster = host.querySelector('[data-crt-raster]');
      if (!shutter || !beam || !raster) return;
      const score = gsap.timeline({ paused: true })
        .fromTo(shutter, { opacity: 1 }, { opacity: 0, duration: 0.2 }, 0.22)
        .fromTo(beam, { scaleX: 0.04, scaleY: 0.005, opacity: 0.4 }, {
          scaleX: 1, scaleY: 0.005, opacity: 0.75, duration: 0.17, ease: 'power2.out',
        }, 0)
        .to(beam, { scaleY: 1, opacity: 0, duration: 0.37, ease: 'power2.inOut' }, 0.17)
        .fromTo(raster, { opacity: 0.12, scaleY: 0.02 }, {
          opacity: 0, scaleY: 1, duration: CRT_POWER_ON_MS / 1000 - 0.2, ease: 'power2.out',
        }, 0.2);
      stop = playVisible(score, () => clearPaint([shutter, beam, raster]));
    }, host);
    return () => { stop(); context.revert(); };
  }, [ref, powered, reduced]);
}
