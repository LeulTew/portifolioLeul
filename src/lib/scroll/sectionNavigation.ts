type Listener = (section: string, options?: SectionNavigationOptions) => void;

export interface SectionNavigationOptions {
  /** Settle a completed chapter's landing without another animation or input lock. */
  immediate?: boolean;
  /** Navbar intent may settle intervening chapters; native scroll never sets this. */
  source?: 'navbar';
  /** A reverse chapter handoff lands on the trailing record, not its heading. */
  edge?: 'end';
}

export type SectionNavigate = (section: string, options?: SectionNavigationOptions) => void;

const listeners = new Set<Listener>();

/** Chapter landings and navbar bypasses stay distinct from native scroll. */
export function publishSectionNavigation(section: string, options?: SectionNavigationOptions): void {
  for (const listener of listeners) {
    if (options) listener(section, options);
    else listener(section);
  }
}

export function subscribeSectionNavigation(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
