import { useSyncExternalStore } from 'react';
import { writeStyleProperty } from '@/lib/dom/cachedElement';
import {
  claimIslandSecret, getIslandSecret, releaseIslandSecret, subscribeIslandSecret,
  setIslandHeroReady, setIslandLayoutReady,
} from '@/lib/scene/islandSecret';

export type AvatarEncounterPhase = 'idle' | 'approaching' | 'meeting' | 'returning' | 'yielding';
type ExitReason = 'return' | 'input' | 'navigation' | 'hidden' | 'unmount' | null;

const view = {
  phase: 'idle' as AvatarEncounterPhase,
  enabled: false,
  available: false,
  heroReady: false,
  layoutReady: true,
  progress: 0,
  attention: 0,
  nod: 0,
  revision: 0,
  exit: null as ExitReason,
};
const listeners = new Set<() => void>();
let surface: { root: HTMLElement; target: HTMLButtonElement } | null = null;

export function getAvatarEncounter(): Readonly<typeof view> { return view; }

export function subscribeAvatarEncounter(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isAvatarPresenting(): boolean {
  return view.phase === 'approaching' || view.phase === 'meeting' || view.phase === 'returning';
}

export function useAvatarEncounterPhase(): AvatarEncounterPhase {
  return useSyncExternalStore(subscribeAvatarEncounter, () => view.phase, () => 'idle');
}

export function useAvatarEncounterAvailable(): boolean {
  return useSyncExternalStore(subscribeAvailability, () => view.available && getIslandSecret() !== 'prism', () => false);
}

function subscribeAvailability(listener: () => void): () => void {
  const releaseView = subscribeAvatarEncounter(listener);
  const releaseSecret = subscribeIslandSecret(listener);
  return () => { releaseView(); releaseSecret(); };
}

export function useAvatarEncounterPresenting(): boolean {
  return useSyncExternalStore(subscribeAvatarEncounter, isAvatarPresenting, () => false);
}

export function setAvatarEncounterPhase(phase: AvatarEncounterPhase): void {
  if (view.phase === phase) return;
  view.phase = phase;
  surface?.root.setAttribute('data-avatar-presenting', String(isAvatarPresenting()));
  listeners.forEach(listener => listener());
}

export function setAvatarAvailability(available: boolean): void {
  const next = available && view.enabled && view.layoutReady;
  if (view.available === next) return;
  view.available = next;
  listeners.forEach(listener => listener());
}

export function setAvatarHeroReady(ready: boolean): void {
  view.heroReady = ready;
  setIslandHeroReady(ready);
}

export function setAvatarLayoutReady(ready: boolean): void {
  view.layoutReady = ready;
  setIslandLayoutReady(ready);
  if (!ready) setAvatarAvailability(false);
}

export function setAvatarEncounterEnabled(enabled: boolean): void {
  view.enabled = enabled;
  if (!enabled) {
    setAvatarAvailability(false);
    abortAvatarEncounter('unmount');
  }
}

export function requestAvatarEncounter(): boolean {
  if (!view.enabled || !view.available || !view.layoutReady || view.phase !== 'idle') return false;
  if (!claimIslandSecret('avatar')) return false;
  view.revision++;
  view.progress = view.attention = view.nod = 0;
  view.exit = null;
  setAvatarEncounterPhase('approaching');
  return true;
}

export function returnFromAvatarEncounter(): void {
  if (view.phase !== 'approaching' && view.phase !== 'meeting') return;
  view.revision++;
  view.exit = 'return';
  setAvatarEncounterPhase('returning');
}

export function yieldAvatarEncounter(): void {
  if (view.phase === 'idle' || view.phase === 'yielding') return;
  view.revision++;
  view.exit = 'input';
  setAvatarEncounterPhase('yielding');
}

export function abortAvatarEncounter(reason: Exclude<ExitReason, 'return' | 'input' | null>): void {
  view.exit = reason;
  view.progress = view.attention = view.nod = 0;
  setAvatarEncounterPhase('idle');
  releaseIslandSecret('avatar');
}

export function finishAvatarReturn(): void {
  view.progress = view.attention = view.nod = 0;
  setAvatarEncounterPhase('idle');
  releaseIslandSecret('avatar');
}

/** One clock, advanced only by the camera owner; no per-frame React publication. */
export function paintAvatarEncounter(progress: number, attention: number, nod: number, reveal: number): void {
  view.progress = progress;
  view.attention = attention;
  view.nod = nod;
  if (surface) writeStyleProperty(surface.root, '--avatar-reveal', reveal.toFixed(4));
}

export function registerAvatarElements(elements: NonNullable<typeof surface>): () => void {
  surface = elements;
  elements.root.setAttribute('data-avatar-presenting', String(isAvatarPresenting()));
  return () => { if (surface === elements) surface = null; };
}

export function paintAvatarTarget(x: number, y: number, width: number, height: number, cueX = width / 2): void {
  if (!surface) return;
  const { target } = surface;
  writeStyleProperty(target, 'transform', `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`);
  writeStyleProperty(target, 'width', `${width.toFixed(1)}px`);
  writeStyleProperty(target, 'height', `${height.toFixed(1)}px`);
  writeStyleProperty(target, '--avatar-cue-x', `${cueX.toFixed(1)}px`);
}

export function resetAvatarEncounter(): void {
  releaseIslandSecret('avatar');
  setIslandHeroReady(false);
  setIslandLayoutReady(true);
  Object.assign(view, {
    phase: 'idle', enabled: false, available: false, heroReady: false, layoutReady: true,
    progress: 0, attention: 0, nod: 0, revision: 0, exit: null,
  });
  surface = null;
  listeners.forEach(listener => listener());
}
