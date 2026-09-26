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
/** The navigations being delivered now, innermost last: one may publish another from its listener. */
const delivering: number[] = [];

/** Chapter landings and navbar bypasses stay distinct from native scroll. */
export function publishSectionNavigation(section: string, options?: SectionNavigationOptions): void {
  delivering.push(++serial);
  try {
    for (const listener of listeners) {
      if (options) listener(section, options);
      else listener(section);
    }
  } finally {
    delivering.pop();
  }
}

/**
 * How many navigations have begun: taken when work starts, it marks every
 * navigation already under way as older than that work (round 15).
 */
export function sectionNavigationSerial(): number {
  return serial;
}

/**
 * Which navigation a listener is being handed now. A listener added while
 * one is delivered is still reached by it, and by an older one that published
 * it and is still being delivered around it; a replay published in between
 * raises the count but not their age (round 16).
 */
export function deliveredSectionNavigation(): number {
  return delivering.at(-1) ?? serial;
}

export function subscribeSectionNavigation(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
