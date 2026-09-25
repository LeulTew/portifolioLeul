/**
 * Home and End as the reader means them: the start and the end of the story.
 *
 * Both keys send a scroller straight to its extreme, and the story's pinned
 * chapters do not follow a jump -- their beats play one at a time and nothing
 * skips them -- so after End the page sat at its end with About still on
 * screen, and in the flat page Home left a chapter painted over position zero
 * (round 8, D-FLAT-002). The navbar already crosses chapters at once and
 * releases them on the way. A terminal key goes where its Home and Contact go:
 * Home to the top of the story, End to the end of Contact. Focus in the story
 * lands in the chapter arrived at, as it does from the navbar -- including
 * focus on the navbar itself; only a body with no focus is left as it is.
 *
 * Passive, like every key listener on this page: the browser's own jump still
 * happens, to the same place. Keys a control uses (`scrollKeyIntent`), keys a
 * chapter has claimed, and keys for a box that scrolls on its own stay theirs.
 */
import { inOwnScroller, isScrollKeyClaimed } from './keyboardScroll';
import { scrollKeyIntent } from './scrollKeys';
import { landSectionFocus } from './sectionLanding';
import type { SectionNavigationOptions } from './sectionNavigation';

export interface StoryKeysOptions {
  /** Navigates as the navbar does. */
  navigate: (section: string, options: SectionNavigationOptions) => void;
  /** drei's track in the 3D page; null where the document scrolls. */
  track?: HTMLElement | null;
  root?: Document;
}

export function installStoryKeys({ navigate, track = null, root = document }: StoryKeysOptions): () => void {
  const view = root.defaultView;
  if (!view) return () => {};
  const travel = (event: KeyboardEvent) => {
    const intent = scrollKeyIntent(event);
    if (intent?.extent !== 'document' || isScrollKeyClaimed(event) || inOwnScroller(event.target, track)) return;
    const section = intent.direction === 'down' ? 'contact' : 'home';
    navigate(section, section === 'contact' ? { source: 'navbar', edge: 'end' } : { source: 'navbar' });
    if (root.activeElement && root.activeElement !== root.body) landSectionFocus(section, root);
  };
  view.addEventListener('keydown', travel, { passive: true });
  return () => view.removeEventListener('keydown', travel);
}
