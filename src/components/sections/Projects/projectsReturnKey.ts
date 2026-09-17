const ARROW_SCROLL_PX = 40;
const PAGE_SCROLL_SHARE = 0.9;

/** Bridge only accepted scene-return keys whose focus is outside Drei's scrollport. */
export function projectsReturnKeyDelta(event: KeyboardEvent, scroller: HTMLElement): number {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0;
  const target = event.target;
  if (target instanceof Node && scroller.contains(target)) return 0;
  if (target instanceof Element && target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), ' +
    '[data-projects-display], [data-projects-tabs], [role="slider"], [role="spinbutton"], [role="listbox"], [role="menu"]',
  )) return 0;
  if (event.key === 'ArrowUp') return -ARROW_SCROLL_PX;
  if (event.key === 'PageUp') return -scroller.clientHeight * PAGE_SCROLL_SHARE;
  if (event.key === 'Home') return -scroller.scrollTop;
  return 0;
}
