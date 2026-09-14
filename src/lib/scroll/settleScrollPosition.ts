import type { ScrollControlsState } from '@react-three/drei';
import { readScrollOffset } from './preserveScrollOffset';
import { setScrollProgress } from './scrollProgress';

type ScrollPosition = Pick<ScrollControlsState, 'el' | 'fixed' | 'offset' | 'delta' | 'pages'>;

/** Consume travel spent under a completed chapter, once, before its overlay releases. */
export function settleScrollPosition(scroll: ScrollPosition, offset: number): void {
  const range = Math.max(scroll.el.scrollHeight - scroll.el.clientHeight, 0);
  scroll.el.scrollTop = Math.min(1, Math.max(0, offset)) * range;
  // Announce the position to Drei's private damping target through its public scrollport.
  scroll.el.dispatchEvent(new Event('scroll'));
  scroll.offset = readScrollOffset(scroll.el);
  scroll.delta = 0;
  const html = scroll.fixed.firstElementChild;
  if (html instanceof HTMLElement) {
    const y = -scroll.el.clientHeight * (scroll.pages - 1) * scroll.offset;
    html.style.transform = `translate3d(0px, ${y}px, 0px)`;
  }
  setScrollProgress(scroll.offset, true);
}
