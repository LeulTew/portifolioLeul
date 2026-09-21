import { useSyncExternalStore } from 'react';
import type { ProjectsPhase } from '@/lib/projects/projectsScene';

export type TVSource = 'off' | 'broadcast' | 'projects';
export type TVMediaStatus = 'idle' | 'loading' | 'playing' | 'blocked' | 'error';
export type TVAction = 'previous' | 'next' | 'power';
export type TVControlsLayout = 'hidden' | 'power' | 'all';

const state = {
  broadcastOn: false,
  channel: 0,
  phase: 'outside' as ProjectsPhase,
  source: 'off' as TVSource,
  exposed: false,
  layout: 'hidden' as TVControlsLayout,
  mediaStatus: 'idle' as TVMediaStatus,
  mediaMessage: '',
  canPage: false,
  commandRevision: 0,
};
let revision = 0;
const listeners = new Set<() => void>();
let reader: { page: (direction: -1 | 1) => void; retreat: () => void } | null = null;
const RESERVED = new Set<ProjectsPhase>(['approaching', 'reading', 'retreating', 'departing']);
const INTERACTIVE = new Set<ProjectsPhase>(['outside', 'revealed', 'framed', 'reading']);

const publish = () => { revision++; listeners.forEach(listener => listener()); };
function updateSource(): void {
  state.source = RESERVED.has(state.phase) ? 'projects' : state.broadcastOn ? 'broadcast' : 'off';
}

export function getTVState(): Readonly<typeof state> { return state; }
export function subscribeTV(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useTVState(): Readonly<typeof state> {
  useSyncExternalStore(subscribeTV, () => revision, () => 0);
  return state;
}
export function setTVProjectPhase(phase: ProjectsPhase): void {
  if (state.phase === phase) return;
  state.phase = phase;
  updateSource();
  publish();
}
export function setTVExposure(exposed: boolean, layout: TVControlsLayout): void {
  if (state.exposed === exposed && state.layout === layout) return;
  state.exposed = exposed;
  state.layout = layout;
  publish();
}
export function setTVMediaStatus(status: TVMediaStatus, message = ''): void {
  if (state.mediaStatus === status && state.mediaMessage === message) return;
  state.mediaStatus = status;
  state.mediaMessage = message;
  publish();
}
export function registerTVReader(controls: NonNullable<typeof reader>): () => void {
  reader = controls;
  return () => {
    if (reader === controls) { reader = null; state.canPage = false; publish(); }
  };
}
export function setTVPagingAvailable(available: boolean): void {
  if (state.canPage === available) return;
  state.canPage = available;
  publish();
}

export function isTVActionEnabled(action: TVAction): boolean {
  if (!state.exposed || state.layout === 'hidden' || !INTERACTIVE.has(state.phase)) return false;
  if (action === 'power') return state.phase !== 'reading' || reader !== null;
  return state.layout === 'all' && (state.source === 'projects'
    ? state.phase === 'reading' && state.canPage && reader !== null : state.broadcastOn);
}

/** Native controls and the physical caps dispatch the same single action. */
export function activateTV(action: TVAction): boolean {
  if (!isTVActionEnabled(action)) return false;
  if (state.source === 'projects') {
    if (!reader) return false;
    const controls = reader;
    if (action === 'power') {
      state.broadcastOn = false;
      state.commandRevision++;
      updateSource();
      publish();
      controls.retreat();
    } else controls.page(action === 'previous' ? -1 : 1);
    return true;
  }
  if (action === 'power') {
    state.broadcastOn = !state.broadcastOn;
  } else {
    state.channel = (state.channel + (action === 'previous' ? -1 : 1) + 2) % 2;
  }
  state.commandRevision++;
  state.mediaMessage = '';
  updateSource();
  publish();
  return true;
}

export function resetTVState(): void {
  reader = null;
  Object.assign(state, { broadcastOn: false, channel: 0, phase: 'outside', source: 'off',
    exposed: false, layout: 'hidden', mediaStatus: 'idle', mediaMessage: '', canPage: false, commandRevision: 0 });
  publish();
}
