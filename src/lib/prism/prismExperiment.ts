import { useSyncExternalStore } from 'react';
import { phaseFrameDelta } from '@/lib/motion/triggeredPhase';
import {
  claimIslandSecret, getIslandReadiness, getIslandSecret, releaseIslandSecret, subscribeIslandSecret,
} from '@/lib/scene/islandSecret';

export type PrismPhase = 'rest' | 'opening' | 'holding' | 'closing';
export const PRISM_OPEN_MS = 2600;
export const PRISM_HOLD_MS = 900;
export const PRISM_CLOSE_MS = 2200;
export const PRISM_CANCEL_MS = 1450;
const view = { phase: 'rest' as PrismPhase, enabled: false, available: false,
  progress: 0, hold: 0, reduced: false, revision: 0, closingDuration: PRISM_CLOSE_MS };
const listeners = new Set<() => void>();
const resetListeners = new Set<() => void>();

export function getPrismExperiment(): Readonly<typeof view> { return view; }
export function subscribePrismExperiment(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function phase(next: PrismPhase): void {
  if (view.phase === next) return;
  view.phase = next;
  listeners.forEach(listener => listener());
}
export function setPrismEnabled(enabled: boolean): void {
  view.enabled = enabled;
  if (!enabled) { setPrismAvailable(false); resetPrismExperiment(); }
}
export function setPrismAvailable(available: boolean): void {
  const next = available && view.enabled && getIslandReadiness().layout;
  if (view.available === next) return;
  view.available = next;
  listeners.forEach(listener => listener());
}
export function requestPrismExperiment(reduced = false): boolean {
  if (!view.available || !view.enabled || !getIslandReadiness().layout ||
      view.phase !== 'rest' || !claimIslandSecret('prism')) return false;
  view.progress = view.hold = 0;
  view.reduced = reduced;
  view.revision++;
  view.closingDuration = PRISM_CLOSE_MS;
  phase(reduced ? 'holding' : 'opening');
  return true;
}
export function closePrismExperiment(): void {
  if (view.phase === 'rest' || view.phase === 'closing') return;
  if (view.reduced || view.progress === 0) { resetPrismExperiment(); return; }
  view.closingDuration = PRISM_CANCEL_MS;
  phase('closing');
}
export function resetPrismExperiment(): void {
  view.progress = view.hold = 0;
  phase('rest');
  releaseIslandSecret('prism');
  resetListeners.forEach(listener => listener());
}
export function subscribePrismReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => { resetListeners.delete(listener); };
}
export function advancePrismExperiment(deltaMs: number, reduced: boolean): void {
  if (view.phase === 'rest') return;
  if (reduced && !view.reduced) { resetPrismExperiment(); return; }
  const dt = phaseFrameDelta(deltaMs);
  if (view.phase === 'opening') {
    view.progress = Math.min(1, view.progress + dt / PRISM_OPEN_MS);
    if (view.progress === 1) phase('holding');
  } else if (view.phase === 'holding') {
    view.hold = Math.min(1, view.hold + dt / (view.reduced ? 500 : PRISM_HOLD_MS));
    if (view.hold === 1) {
      if (view.reduced) resetPrismExperiment();
      else phase('closing');
    }
  } else {
    view.progress = Math.max(0, view.progress - dt / view.closingDuration);
    if (view.progress === 0) resetPrismExperiment();
  }
}
export function usePrismPhase(): PrismPhase {
  return useSyncExternalStore(subscribePrismExperiment, () => view.phase, () => 'rest');
}
function subscribeAvailability(listener: () => void): () => void {
  const one = subscribePrismExperiment(listener), two = subscribeIslandSecret(listener);
  return () => { one(); two(); };
}
export function usePrismAvailable(): boolean {
  return useSyncExternalStore(subscribeAvailability,
    () => view.available && getIslandSecret() !== 'avatar', () => false);
}
