/**
 * What a key asks the page's scroller to do, decided once for everything that
 * listens: the physical scroll that `keyboardScroll` forwards to drei's track,
 * and the chapter request that `scrollGesture` reports to the beats.
 *
 * Two classifiers used to answer this separately and disagreed: Shift+Space
 * scrolled the track back up while the gesture store asked the chapter for
 * its next beat (round 8, TECH-013). Both now read this one.
 *
 * The rules are Chromium's for keyboard scrolling (MapKeyCodeForScroll and
 * its space handling): arrows, Page Up/Down, Home/End and Space scroll;
 * Shift reverses Space and disables the others; Control only scrolls with
 * Home/End; Alt and Meta do not scroll. A key a control uses for itself --
 * typing in a field, Space pressing a button, arrows moving within a keyed
 * widget, or anything a handler already prevented -- is not a scroll.
 */

export type ScrollDirection = 'down' | 'up';

/** How far a key scrolls: a line, a page, or to the end of the document. */
export type ScrollExtent = 'line' | 'page' | 'document';

export interface ScrollKeyIntent {
  direction: ScrollDirection;
  extent: ScrollExtent;
}

/** Controls that give these keys a meaning of their own. */
const KEYED_CONTROLS = [
  'input', 'textarea', 'select', '[contenteditable]:not([contenteditable="false"])',
  ...['slider', 'spinbutton', 'listbox', 'menu', 'menubar', 'tablist', 'radiogroup', 'grid', 'tree', 'treegrid', 'combobox']
    .map(role => `[role="${role}"]`),
].join(',');

/** Controls that Space activates rather than scrolls past. */
const SPACE_ACTIVATES = [
  'button', 'summary',
  ...['button', 'checkbox', 'switch', 'radio', 'tab', 'menuitem', 'option'].map(role => `[role="${role}"]`),
].join(',');

const KEYS: Record<string, ScrollKeyIntent> = {
  ArrowDown: { direction: 'down', extent: 'line' },
  ArrowUp: { direction: 'up', extent: 'line' },
  PageDown: { direction: 'down', extent: 'page' },
  PageUp: { direction: 'up', extent: 'page' },
  End: { direction: 'down', extent: 'document' },
  Home: { direction: 'up', extent: 'document' },
};

const isSpace = (key: string) => key === ' ' || key === 'Spacebar';

/** The scroll this key asks for, or null when it asks for none. */
export function scrollKeyIntent(event: KeyboardEvent): ScrollKeyIntent | null {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.metaKey) return null;
  const space = isSpace(event.key);
  let intent: ScrollKeyIntent | undefined;
  if (space) {
    if (event.ctrlKey) return null;
    intent = { direction: event.shiftKey ? 'up' : 'down', extent: 'page' };
  } else {
    if (event.shiftKey) return null;
    intent = KEYS[event.key];
    if (!intent || (event.ctrlKey && intent.extent !== 'document')) return null;
  }
  const target = event.target;
  if (target instanceof Element) {
    if (target.closest(KEYED_CONTROLS)) return null;
    if (space && target.closest(SPACE_ACTIVATES)) return null;
  }
  return intent;
}
