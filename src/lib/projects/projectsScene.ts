import { useSyncExternalStore } from 'react';

export type ProjectsPhase =
  | 'outside' | 'withdrawing' | 'revealed' | 'turning' | 'framed'
  | 'approaching' | 'reading' | 'retreating' | 'unturning' | 'departing';

export interface ProjectsView {
  active: boolean;
  turn: number;
  approach: number;
  visit: number;
  entry: 'skills' | 'contact';
  reading: boolean;
}

const view: ProjectsView = { active: false, turn: 0, approach: 0, visit: 0, entry: 'skills', reading: false };
const activeListeners = new Set<() => void>();
const readyListeners = new Set<() => void>();
const handoffListeners = new Set<(phase: 'withdrawing' | 'revealed') => void>();
let screenReady = false;
let surface: HTMLElement | null = null;
let holdingForSkills = false;
let returnOwed = false;

/** The camera reads this in place; animation frames never reconcile React. */
export function getProjectsView(): Readonly<ProjectsView> {
  return view;
}

export function setProjectsView(
  active: boolean, turn: number, approach: number, entry?: ProjectsView['entry'],
): void {
  const changed = view.active !== active;
  if (changed && active) view.visit++;
  if (!active) {
    holdingForSkills = false;
    view.reading = false;
  }
  view.active = active;
  view.turn = turn;
  view.approach = approach;
  if (entry) view.entry = entry;
  if (changed) activeListeners.forEach(listener => listener());
}

export function setProjectsReading(reading: boolean): void {
  view.reading = reading;
}

export function holdProjectsViewForSkills(): void {
  holdingForSkills = true;
}

/** The reversing plate covers the world before its camera ownership is released. */
export function finishProjectsSkillsReturn(): void {
  if (holdingForSkills) setProjectsView(false, view.turn, view.approach);
}

/** A native return from Contact must visit the TV before any earlier chapter. */
export function setProjectsReturnOwed(value: boolean): void {
  returnOwed = value;
}

export function isProjectsReturnOwed(): boolean {
  return returnOwed;
}

const subscribeActive = (listener: () => void) => {
  activeListeners.add(listener);
  return () => { activeListeners.delete(listener); };
};
const subscribeReady = (listener: () => void) => {
  readyListeners.add(listener);
  return () => { readyListeners.delete(listener); };
};

export function useProjectsActive(): boolean {
  return useSyncExternalStore(subscribeActive, () => view.active, () => false);
}

export function useTVScreenReady(): boolean {
  return useSyncExternalStore(subscribeReady, () => screenReady, () => false);
}

export function setTVScreenReady(ready: boolean): void {
  if (screenReady === ready) return;
  screenReady = ready;
  readyListeners.forEach(listener => listener());
}

export function registerProjectsSurface(element: HTMLElement): () => void {
  surface = element;
  return () => { if (surface === element) surface = null; };
}

export function getProjectsSurface(): HTMLElement | null {
  return surface;
}

/** Returns false when the flat reader, rather than the TV chapter, is mounted. */
export function publishSkillsProjectsHandoff(phase: 'withdrawing' | 'revealed'): boolean {
  if (!handoffListeners.size) return false;
  handoffListeners.forEach(listener => listener(phase));
  return true;
}

export function subscribeSkillsProjectsHandoff(
  listener: (phase: 'withdrawing' | 'revealed') => void,
): () => void {
  handoffListeners.add(listener);
  return () => { handoffListeners.delete(listener); };
}
