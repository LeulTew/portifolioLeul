/**
 * The DOM button the prism projection places over the island's prism.
 * Kept apart from the projection, which needs three, so the avatar's DOM
 * trigger does not pull the graphics library into the no-WebGL page (round
 * 10, TECH-029).
 */
let target: HTMLButtonElement | null = null;

export function registerPrismTarget(element: HTMLButtonElement): () => void {
  target = element;
  return () => { if (target === element) target = null; };
}

export function prismTarget(): HTMLButtonElement | null {
  return target;
}
