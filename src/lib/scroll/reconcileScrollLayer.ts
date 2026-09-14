import type { ScrollControlsState } from '@react-three/drei';
import { readScrollOffset } from './preserveScrollOffset';

type ScrollLayer = Pick<ScrollControlsState, 'el' | 'fixed' | 'offset' | 'delta' | 'eps' | 'pages'>;
const settled = new WeakMap<HTMLElement, { y: number; serialized: string }>();

export function reconcileScrollLayer(scroll: ScrollLayer, height: number): boolean {
  const html = scroll.fixed.firstElementChild;
  if (!(html instanceof HTMLElement) || scroll.delta > scroll.eps) return false;
  const y = -height * (scroll.pages - 1) * scroll.offset;
  const current = html.style.transform;
  const previous = settled.get(html);
  if (previous?.y === y && previous.serialized === current) return false;
  if (Math.abs(readScrollOffset(scroll.el) - scroll.offset) > scroll.eps) return false;

  const transform = `translate3d(0px, ${y}px, 0px)`;
  const changed = current !== transform;
  if (changed) html.style.transform = transform;
  // CSSOM rounds translations. Remember its serialization, not the authored float.
  settled.set(html, { y, serialized: html.style.transform });
  return changed;
}
