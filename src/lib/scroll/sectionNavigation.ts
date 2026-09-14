type Listener = (section: string) => void;

export interface SectionNavigationOptions {
  /** Settle a completed chapter's landing without another animation or input lock. */
  immediate?: boolean;
}

export type SectionNavigate = (section: string, options?: SectionNavigationOptions) => void;

const listeners = new Set<Listener>();

/** Explicit navigation can leave a reading stage; scroll momentum cannot. */
export function publishSectionNavigation(section: string): void {
  for (const listener of listeners) listener(section);
}

export function subscribeSectionNavigation(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
