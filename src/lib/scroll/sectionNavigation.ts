type Listener = (section: string, options?: SectionNavigationOptions) => void;

export interface SectionNavigationOptions {
  /** Settle a completed chapter's landing without another animation or input lock. */
  immediate?: boolean;
  /** Navbar intent may settle intervening chapters; native scroll never sets this. */
  source?: 'navbar';
  /** A reverse chapter handoff lands on the trailing record, not its heading. */
  edge?: 'end';
  /** Lands on this element of the section, by id, instead of the section's own edge. */
  anchor?: string;
  /**
   * A layout change taking the reader back to where they already were, not a
   * new choice: Skills resuming its chapter after a remount, and the replay of
   * that navigation after a track rebuild (round 15, TECH-050).
   */
  resume?: true;
}

export type SectionNavigate = (section: string, options?: SectionNavigationOptions) => void;

const listeners = new Set<Listener>();
let serial = 0;

/** Chapter landings and navbar bypasses stay distinct from native scroll. */
export function publishSectionNavigation(section: string, options?: SectionNavigationOptions): void {
  serial += 1;
  for (const listener of listeners) {
    if (options) listener(section, options);
    else listener(section);
  }
}

/**
 * How many navigations have begun. A listener added while one is being
 * delivered -- or while an older one, which published it, is still being
 * delivered -- is still reached by those: compared with this, it can tell
 * them from a navigation that begins after it (round 15).
 */
export function sectionNavigationSerial(): number {
  return serial;
}

export function subscribeSectionNavigation(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
