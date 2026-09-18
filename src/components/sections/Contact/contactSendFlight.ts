import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { phaseFrameDelta } from '@/lib/motion/triggeredPhase';
import { subscribeSectionNavigation } from '@/lib/scroll/sectionNavigation';

export const CONTACT_SEND_FOLD_MS = 1140;
export const CONTACT_SEND_DURATION_MS = 2350;

// Collinear vertices let the chamfered sheet keep the same path through every fold.
export const CONTACT_PAPER_PLANE = {
  outline: 'M55 58L183 17L161 77.5L139 138L112 89L83.5 73.5Z',
  wing: 'M55 58L112 89L183 17Z',
  tail: 'M183 17L139 138L112 89Z',
  keel: 'M112 89L105 119L126 109Z',
  crease: 'M183 17L112 89L105 119L126 109',
};

type SendPhase = 'ready' | 'folding' | 'sent';

export function useContactSendFlight(
  ref: RefObject<HTMLDivElement>, accepted: boolean, reduced: boolean, enabled: boolean,
): SendPhase {
  const [phase, setPhase] = useState<SendPhase>('ready');
  const completed = useRef(false);

  useLayoutEffect(() => {
    if (!accepted) {
      completed.current = false;
      setPhase('ready');
      return;
    }
    const host = ref.current;
    if (!host) return;
    const sheet = host.querySelector<HTMLElement>('[data-send-sheet]');
    const form = host.querySelector('form');
    const paper = host.querySelector<SVGSVGElement>('[data-send-paper]');
    const outline = host.querySelector<SVGPathElement>('[data-send-outline]');
    const wing = host.querySelector<SVGPathElement>('[data-send-wing]');
    const tail = host.querySelector<SVGPathElement>('[data-send-tail]');
    const keel = host.querySelector<SVGPathElement>('[data-send-keel]');
    const crease = host.querySelector<SVGPathElement>('[data-send-crease]');
    if (!sheet || !form || !paper || !outline || !wing || !tail || !keel || !crease) {
      console.warn('Contact send artwork unavailable; keeping the accepted-send confirmation.');
      completed.current = true;
      setPhase('sent');
      return;
    }
    const bounds = sheet.getBoundingClientRect();
    if (completed.current || reduced || !enabled || document.hidden ||
        bounds.width <= 0 || bounds.height <= 0 || bounds.bottom <= 0 || bounds.top >= innerHeight) {
      completed.current = true;
      setPhase('sent');
      return;
    }

    let frame = 0;
    let last = performance.now();
    let disposed = false;
    let context: gsap.Context | undefined;
    let score: gsap.core.Timeline;
    let removeNavigation = () => {};
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => !entry.isIntersecting)) finish();
    });
    const dispose = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', finish);
      removeNavigation();
      observer.disconnect();
      context?.revert();
      context = undefined;
    };
    function finish() {
      if (disposed) return;
      disposed = true;
      completed.current = true;
      // Hide the departed sheet before reverting paint, not a React commit later.
      host!.dataset.sendPhase = 'sent';
      dispose();
      setPhase('sent');
    }
    function wake() {
      if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(tick);
    }
    function tick(now: number) {
      frame = 0;
      if (disposed || document.hidden) return;
      const time = Math.min(score.duration(), score.time() + phaseFrameDelta(now - last) / 1000);
      last = now;
      score.time(time, true);
      if (score.time() >= score.duration()) finish();
      else wake();
    }
    function visibility() {
      cancelAnimationFrame(frame);
      frame = 0;
      last = performance.now();
      wake();
    }

    const cutX = 26 / bounds.width * 200;
    const cutY = 26 / bounds.height * 160;
    const scaleX = Math.min(200, bounds.width * 0.5) / bounds.width;
    const scaleY = scaleX * bounds.width * 0.8 / bounds.height;
    const destinationX = innerWidth * 0.54 - (bounds.left + bounds.width / 2);
    const destinationY = Math.min(-bounds.height * 0.85, innerHeight * 0.04 - (bounds.top + bounds.height / 2));

    setPhase('folding');
    context = gsap.context(() => {
      gsap.set(form, {
        clipPath: `polygon(${cutX / 2}% 0%,100% 0%,100% ${100 - cutY / 1.6}%,${100 - cutX / 2}% 100%,0% 100%,0% ${cutY / 1.6}%)`,
      });
      gsap.set(paper, { opacity: 1 });
      gsap.set(outline, {
        opacity: 0,
        attr: { d: `M${cutX} 0L200 0L200 ${160 - cutY}L${200 - cutX} 160L0 160L0 ${cutY}Z` },
      });
      gsap.set(crease, { opacity: 0 });
      score = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } })
        .addLabel('fold', 0)
        .to(sheet, { scaleX: 0.8, scaleY: 0.72, y: -bounds.height * 0.05, rotation: -4, duration: 0.64 }, 'fold')
        .to(wing, { attr: { d: 'M0 0L104 80L0 160Z' }, duration: 0.34 }, 'fold')
        .to(tail, { attr: { d: 'M200 0L98 80L200 160Z' }, duration: 0.34 }, 0.12)
        .to(keel, { attr: { d: 'M0 160L100 72L200 160Z' }, duration: 0.38 }, 0.24)
        .to(form, {
          clipPath: 'polygon(10% 20%,90% 20%,90% 80%,90% 80%,10% 80%,10% 20%)',
          opacity: 0, duration: 0.38,
        }, 0.3)
        .to(outline, {
          opacity: 1, attr: { d: 'M20 32L180 32L180 128L180 128L20 128L20 32Z' }, duration: 0.38,
        }, 0.3)
        .to(wing, { attr: { d: 'M20 32L104 80L20 128Z' }, duration: 0.28 }, 0.36)
        .to(tail, { attr: { d: 'M180 32L98 80L180 128Z' }, duration: 0.22 }, 0.46)
        .to(keel, { attr: { d: 'M20 128L100 72L180 128Z' }, duration: 0.12 }, 0.62)
        .addLabel('plane', 0.74)
        .to(outline, { attr: { d: CONTACT_PAPER_PLANE.outline }, duration: 0.4 }, 'plane')
        .to(wing, { attr: { d: CONTACT_PAPER_PLANE.wing }, duration: 0.4 }, 'plane')
        .to(tail, { attr: { d: CONTACT_PAPER_PLANE.tail }, duration: 0.4 }, 'plane')
        .to(keel, { attr: { d: CONTACT_PAPER_PLANE.keel }, duration: 0.4 }, 'plane')
        .to(crease, { opacity: 1, duration: 0.3 }, 'plane+=0.1')
        .to(sheet, { scaleX, scaleY, y: -bounds.height * 0.23, rotation: -12, duration: 0.5 }, 0.64)
        .addLabel('flight', CONTACT_SEND_FOLD_MS / 1000)
        .to(sheet, {
          x: destinationX * 0.15, y: destinationY * 0.48, rotation: -46,
          scaleX: scaleX * 0.88, scaleY: scaleY * 0.88, duration: 0.38, ease: 'power1.in',
        }, 'flight')
        .to(sheet, {
          x: destinationX, y: destinationY, rotation: -72,
          scaleX: scaleX * 0.07, scaleY: scaleY * 0.07, duration: 0.83, ease: 'power2.in',
        }, 'flight+=0.38')
        .to(sheet, { opacity: 0, duration: 0.35, ease: 'power1.in' }, (CONTACT_SEND_DURATION_MS / 1000) - 0.35);
    }, host);
    removeNavigation = subscribeSectionNavigation(target => { if (target !== 'contact') finish(); });
    observer.observe(host);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('resize', finish);
    wake();
    return () => {
      disposed = true;
      completed.current = true;
      dispose();
    };
  }, [ref, accepted, reduced, enabled]);

  return phase;
}
