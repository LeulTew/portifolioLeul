export type IslandSecret = 'avatar' | 'prism';
let owner: IslandSecret | null = null;
const listeners = new Set<() => void>();
const readiness = { hero: false, layout: true };

export function getIslandReadiness(): Readonly<typeof readiness> { return readiness; }
export function setIslandHeroReady(ready: boolean): void { readiness.hero = ready; }
export function setIslandLayoutReady(ready: boolean): void { readiness.layout = ready; }

export function getIslandSecret(): IslandSecret | null { return owner; }

export function claimIslandSecret(next: IslandSecret): boolean {
  if (owner !== null) return false;
  owner = next;
  listeners.forEach(listener => listener());
  return true;
}

export function releaseIslandSecret(current: IslandSecret): void {
  if (owner !== current) return;
  owner = null;
  listeners.forEach(listener => listener());
}

export function subscribeIslandSecret(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
