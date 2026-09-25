import { useSyncExternalStore } from 'react';
import { CONTACT_REVEAL_START } from '@/lib/camera/contactTiming';

export type ContactMode = 'outside' | 'departing' | 'parked' | 'returning';

interface ContactView {
  mode: ContactMode;
  progress: number;
  revision: number;
  committed: number;
  revealed: boolean;
}

const view: ContactView = { mode: 'outside', progress: 0, revision: 0, committed: -1, revealed: false };
const listeners = new Set<() => void>();
const poseListeners = new Set<() => void>();
const cameras = new Set<object>();

export function getContactView(): Readonly<ContactView> {
  return view;
}

function mode(next: ContactMode): void {
  const revealed = next !== 'outside' && view.progress > CONTACT_REVEAL_START;
  if (view.mode === next && view.revealed === revealed) return;
  view.mode = next;
  view.revealed = revealed;
  listeners.forEach(listener => listener());
}

export function beginContactFlight(direction: 1 | -1): void {
  view.revision++;
  view.progress = direction === 1 ? 0 : 1;
  mode(direction === 1 ? 'departing' : 'returning');
}

export function setContactProgress(progress: number): void {
  if (!Number.isFinite(progress)) throw new RangeError('Contact progress must be finite.');
  view.progress = Math.min(1, Math.max(0, progress));
  mode(view.mode);
}

export function parkContactSky(): void {
  view.progress = 1;
  mode('parked');
}

export function releaseContactSky(): void {
  view.progress = 0;
  mode('outside');
}

export function registerContactCamera(): () => void {
  const owner = {};
  cameras.add(owner);
  return () => { cameras.delete(owner); };
}

export function hasContactCamera(): boolean {
  return cameras.size > 0;
}

export function isContactPoseCommitted(): boolean {
  return view.committed === view.revision;
}

/** Defer the endpoint receipt until the camera, projection and draw have run. */
export function commitContactPose(revision: number, progress: number): void {
  const endpoint = view.mode === 'departing' ? 1 : view.mode === 'returning' ? 0 : null;
  if (endpoint === null || progress !== endpoint || view.committed === revision) return;
  queueMicrotask(() => {
    if (document.hidden || view.revision !== revision || view.progress !== endpoint ||
        (view.mode !== 'departing' && view.mode !== 'returning') || view.committed === revision) return;
    view.committed = revision;
    poseListeners.forEach(listener => listener());
  });
}

export function subscribeContactPose(listener: () => void): () => void {
  poseListeners.add(listener);
  return () => { poseListeners.delete(listener); };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useContactMode(): ContactMode {
  return useSyncExternalStore(subscribe, () => view.mode, () => 'outside');
}

export function useContactRevealed(): boolean {
  return useSyncExternalStore(subscribe, () => view.revealed, () => false);
}
