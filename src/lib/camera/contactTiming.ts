import { easeInOutCubic } from '@/lib/motion/triggeredPhase';

/**
 * The Contact flight's clock, apart from its camera path: the DOM chapters
 * time their reveal by it, and must not pull three into the no-WebGL page
 * (round 10, TECH-029).
 */
export const CONTACT_FLIGHT_MS = 2000;
export const CONTACT_REVEAL_START = 0.66;
export const CONTACT_REVEAL_END = 0.92;

export function contactReveal(progress: number): number {
  return easeInOutCubic(Math.min(1, Math.max(0,
    (progress - CONTACT_REVEAL_START) / (CONTACT_REVEAL_END - CONTACT_REVEAL_START),
  )));
}
