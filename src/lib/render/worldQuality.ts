import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { GpuTierConfig } from '@/lib/gateways/gpuTier';

/**
 * The 3D world's cost, lowered while it cannot keep its cadence and raised
 * again once it can (round 8, TECH-009).
 *
 * The GPU tier is a guess made once at load from memory, cores and the
 * renderer's name. It cannot see a laptop on battery, a GPU shared with a
 * video call, thermal throttling, or a 4K panel on a mid-range card. What can
 * be seen is whether the world draws on time. The frame gate hands this module
 * the spacing of every frame it draws; when, over two seconds, a third of them
 * arrive more than half a budget late, the world steps down -- first to 30
 * redraws a second (the page itself keeps the display's rate), then to one
 * device pixel per CSS pixel. After ten calm seconds it tries the step back up.
 * A try that meets pressure again within four seconds doubles the wait before
 * the next, so a device that cannot hold the higher step settles below it
 * after a few tries, while one passing spike costs nothing.
 *
 * Only frames the world drew count: a covered, hidden or still world proves
 * neither pressure nor calm. A stall -- a collection, a first-use shader --
 * counts as one late frame with its time capped at a quarter of a second, so
 * one is a sliver of a window while a renderer that stalls on every frame
 * fills its windows; and the first seconds of drawing, while shaders compile
 * and textures upload, are not judged.
 */

export interface WorldQuality {
  /** 0 is the tier's own quality; each level above it costs less. */
  level: number;
  /** Redraw ceiling for the world, in frames per second. */
  maxFps: number;
  dpr: GpuTierConfig['dpr'];
}

/** The tier's quality, then each cheaper step it has room for. */
export function worldQualitySteps({ maxFps, dpr }: Pick<GpuTierConfig, 'maxFps' | 'dpr'>): WorldQuality[] {
  const steps: WorldQuality[] = [{ level: 0, maxFps, dpr }];
  const halved = maxFps > 0 ? Math.min(maxFps, 30) : 30;
  if (halved !== maxFps) steps.push({ level: steps.length, maxFps: halved, dpr });
  if (dpr[1] > 1) steps.push({ level: steps.length, maxFps: halved, dpr: [Math.min(dpr[0], 1), 1] });
  return steps;
}

export interface PressurePolicy {
  /** Seconds of drawn frames judged together. */
  windowSeconds: number;
  /** A frame this many budgets after the last one is late. */
  lateFactor: number;
  /** The share of late frames that makes a window pressure. */
  pressureShare: number;
  /** The share a window may have and still count as calm. */
  calmShare: number;
  /** Calm seconds before the first try at the step up. */
  recoverSeconds: number;
  /** The longest wait between tries. */
  maxRecoverSeconds: number;
  /** Pressure this soon after a step up means the try failed. */
  probeSeconds: number;
  /** The most one frame adds to the judged clock: a longer frame is a stall, one late frame. */
  stallSeconds: number;
  /** Seconds of drawing before anything is judged. */
  warmupSeconds: number;
}

export const PRESSURE_POLICY: PressurePolicy = {
  windowSeconds: 2,
  lateFactor: 1.5,
  pressureShare: 1 / 3,
  calmShare: 0.05,
  recoverSeconds: 10,
  maxRecoverSeconds: 160,
  probeSeconds: 4,
  stallSeconds: 0.25,
  warmupSeconds: 3,
};

/** More than enough for a window of frames at any display rate. */
const WINDOW_CAPACITY = 2048;
const NOMINAL_BUDGET = 1 / 60;

export interface PressureGauge {
  readonly level: number;
  /** One drawn frame, `interval` seconds after the last, against a budget in seconds; returns the level. */
  observe(interval: number, budget: number): number;
  /** The world stopped drawing: what was being judged no longer holds. */
  pause(): void;
}

export function createPressureGauge(levels: number, policy: PressurePolicy = PRESSURE_POLICY): PressureGauge {
  const at = new Float64Array(WINDOW_CAPACITY);
  const late = new Uint8Array(WINDOW_CAPACITY);
  let head = 0;
  let count = 0;
  let lateCount = 0;
  let level = 0;
  /** Seconds of drawing observed, the clock everything here is measured on. */
  let drawn = 0;
  let calmSince = 0;
  let raisedAt = Number.NEGATIVE_INFINITY;
  let wait = policy.recoverSeconds;

  const clear = () => { head = count = lateCount = 0; };
  const change = (next: number) => {
    level = next;
    calmSince = drawn;
    clear();
  };
  const lower = () => {
    // Pressure right after a raise: that quality is not holding, so wait longer before the next try.
    if (drawn - raisedAt < policy.probeSeconds) wait = Math.min(policy.maxRecoverSeconds, wait * 2);
    change(level + 1);
  };
  const raise = () => {
    raisedAt = drawn;
    change(level - 1);
  };

  return {
    get level() { return level; },
    observe(interval, budget) {
      if (!(interval > 0)) return level;
      // A stall -- a collection, a first-use compile -- counts as one late frame, its time
      // capped: alone it is a sliver of a window of ordinary frames, while a renderer that
      // stalls frame after frame fills its windows with them (round 9, TECH-021).
      drawn += Math.min(interval, policy.stallSeconds);
      if (drawn < policy.warmupSeconds) return level;

      const isLate = interval > policy.lateFactor * (budget > 0 ? budget : NOMINAL_BUDGET);
      if (count === WINDOW_CAPACITY) {
        lateCount -= late[head];
        head = (head + 1) % WINDOW_CAPACITY;
        count--;
      }
      const tail = (head + count) % WINDOW_CAPACITY;
      at[tail] = drawn;
      late[tail] = isLate ? 1 : 0;
      count++;
      lateCount += late[tail];
      while (count && at[head] <= drawn - policy.windowSeconds) {
        lateCount -= late[head];
        head = (head + 1) % WINDOW_CAPACITY;
        count--;
      }

      // A window only counts once it spans all of its length but one stall since the last change.
      const spans = count > 1 && drawn - at[head] >= policy.windowSeconds - policy.stallSeconds;
      const share = count ? lateCount / count : 0;
      if (spans && share >= policy.pressureShare && level < levels - 1) lower();
      else if (share > policy.calmShare) calmSince = drawn;
      else if (level > 0 && drawn - calmSince >= wait) raise();
      return level;
    },
    pause: clear,
  };
}

let levels = 1;
let gauge = createPressureGauge(levels);
let notifying = false;
const listeners = new Set<() => void>();

/** Sets how many steps the world has; restarts the judgement at its own quality. */
export function setWorldQualityLevels(count: number): void {
  const next = Math.max(1, Math.floor(count));
  if (next === levels) return;
  levels = next;
  gauge = createPressureGauge(levels);
  announce();
}

/** Announced outside the frame that decided it, so no render runs inside an animation frame. */
function announce() {
  if (notifying) return;
  notifying = true;
  setTimeout(() => {
    notifying = false;
    for (const listener of listeners) listener();
  }, 0);
}

export function observeWorldFrame(interval: number, budget: number): void {
  const before = gauge.level;
  if (gauge.observe(interval, budget) !== before) announce();
}

export function pauseWorldQuality(): void {
  gauge.pause();
}

export function getWorldQualityLevel(): number {
  return gauge.level;
}

export function subscribeWorldQuality(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The world's current quality for this tier. */
export function useWorldQuality(tier: Pick<GpuTierConfig, 'maxFps' | 'dpr'>): WorldQuality {
  const steps = useMemo(() => worldQualitySteps(tier), [tier]);
  useEffect(() => setWorldQualityLevels(steps.length), [steps.length]);
  const level = useSyncExternalStore(subscribeWorldQuality, getWorldQualityLevel, () => 0);
  return steps[Math.min(level, steps.length - 1)];
}

/** Test-only: back to one level, unjudged. */
export function resetWorldQuality(): void {
  levels = 1;
  gauge = createPressureGauge(levels);
  listeners.clear();
  notifying = false;
}
