import { useEffect, type RefObject } from 'react';
import { writeAttribute } from './cachedElement';

/**
 * Marks a scroll box `data-overflow="more"` while its content continues below
 * the fold, so the box can say so. The TV reader's copy scrolls inside a small
 * screen at compact sizes, where the written cue to scroll is announced but
 * not drawn (round 8, D-UI-001): the fold itself has to show there is more.
 *
 * Measured after layout -- on resize of the box or its content -- and after a
 * scroll, once a frame. `key` names the content, so a new project re-measures.
 */
export function useOverflowHint(ref: RefObject<HTMLElement | null>, key: unknown): void {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const more = box.scrollHeight - box.clientHeight - box.scrollTop > 2;
      writeAttribute(box, 'data-overflow', more ? 'more' : null);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    schedule();
    box.addEventListener('scroll', schedule, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(box);
    for (const child of box.children) observer?.observe(child);
    return () => {
      cancelAnimationFrame(frame);
      box.removeEventListener('scroll', schedule);
      observer?.disconnect();
      writeAttribute(box, 'data-overflow', null);
    };
  }, [ref, key]);
}
