type Listener = (section: string) => void;

const listeners = new Set<Listener>();

/** Explicit navigation can leave a reading stage; scroll momentum cannot. */
export function publishSectionNavigation(section: string): void {
  for (const listener of listeners) listener(section);
}

export function subscribeSectionNavigation(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
