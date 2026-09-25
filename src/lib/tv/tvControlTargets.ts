import type { TVControlId } from './tvHardware';

/**
 * The DOM buttons the TV control projection places over the cabinet's keys.
 * Kept apart from the projection, which needs three, so the DOM controls do
 * not pull the graphics library into the no-WebGL page (round 10, TECH-029).
 */
export type TVTargets = Record<TVControlId, HTMLButtonElement | null>;

let targets: TVTargets | null = null;

export function registerTVTargets(elements: TVTargets): () => void {
  targets = elements;
  return () => { if (targets === elements) targets = null; };
}

export function tvTargets(): TVTargets | null {
  return targets;
}
