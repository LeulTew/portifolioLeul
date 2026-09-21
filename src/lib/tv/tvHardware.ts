export const TV_CONTROL_IDS = ['previous', 'next', 'power'] as const;
export type TVControlId = typeof TV_CONTROL_IDS[number];
export type TVHardwareEventKind = 'press' | 'hover' | 'focus';

export interface TVControl {
  /** Screen-local coordinates, in the display's existing screen-pitch group. */
  readonly center: readonly [number, number, number];
  /** Alias for projection code; the same immutable tuple as center. */
  readonly position: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

/**
 * Native targets project these fixed anchors, not the travelling cap vertices.
 * The full fascia is reserved for hardware; the redundant upper grille is removed.
 * Wide spacing keeps native 48px targets separate in the framed broadcast pose,
 * not merely after the Projects close-up.
 */
const control = (
  center: TVControl['center'], width: number, height: number, radius: number,
): TVControl => ({ center, position: center, width, height, radius });

export const TV_CONTROLS: Readonly<Record<TVControlId, TVControl>> = {
  previous: control([-0.25, -0.215, 0.045], 0.072, 0.052, 0.006),
  next: control([0, -0.215, 0.045], 0.072, 0.052, 0.006),
  power: control([0.27, -0.215, 0.045], 0.056, 0.052, 0.01),
};

export const TV_HARDWARE_MOTION = {
  pressTravel: 0.008,
  powerLatchTravel: 0.0025,
  downSeconds: 0.075,
  minimumHoldSeconds: 0.05,
  upSeconds: 0.13,
  latchSeconds: 0.13,
} as const;

type HardwareCallback = (id: TVControlId, kind: TVHardwareEventKind, active: boolean) => void;
const hardwareListeners = new Set<HardwareCallback>();

/** Feedback only: the native overlay remains the sole owner of navigation/actions. */
export function registerTVHardware(callback: HardwareCallback): () => void {
  hardwareListeners.add(callback);
  return () => { hardwareListeners.delete(callback); };
}

export function dispatchTVHardware(id: TVControlId, kind: TVHardwareEventKind, active: boolean): void {
  for (const listener of hardwareListeners) listener(id, kind, active);
}

type PressPhase = 'idle' | 'down' | 'hold' | 'held' | 'up';
interface CapMotion {
  held: boolean;
  phase: PressPhase;
  elapsed: number;
  from: number;
  value: number;
}

const newCapMotion = (): CapMotion => ({
  held: false, phase: 'idle', elapsed: 0, from: 0, value: 0,
});
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * A finite mechanical score advanced by the existing R3F frame callback.
 * No scheduler, React updates, frame allocations or media/navigation state.
 * A held key becomes stationary after its minimum dwell; it is not a ticker.
 */
export class TVHardwareMotion {
  private readonly caps: Record<TVControlId, CapMotion> = {
    previous: newCapMotion(), next: newCapMotion(), power: newCapMotion(),
  };
  private latch: number;
  private latchFrom: number;
  private latchTarget: number;
  private latchElapsed: number = TV_HARDWARE_MOTION.latchSeconds;
  private reduced = false;

  constructor(powered: boolean) {
    this.latch = this.latchFrom = this.latchTarget = Number(powered);
  }

  get moving(): boolean {
    if (this.latch !== this.latchTarget) return true;
    for (const id of TV_CONTROL_IDS) {
      const phase = this.caps[id].phase;
      if (phase === 'down' || phase === 'hold' || phase === 'up') return true;
    }
    return false;
  }

  depth(id: TVControlId): number {
    return this.caps[id].value * TV_HARDWARE_MOTION.pressTravel
      + (id === 'power' ? this.latch * TV_HARDWARE_MOTION.powerLatchTravel : 0);
  }

  setPowered(powered: boolean): void {
    const target = Number(powered);
    if (target === this.latchTarget) return;
    this.latchFrom = this.latch;
    this.latchTarget = target;
    this.latchElapsed = 0;
    if (this.reduced) this.latch = target;
  }

  setReducedMotion(reduced: boolean): void {
    if (reduced === this.reduced) return;
    this.reduced = reduced;
    this.reset();
  }

  setPressed(id: TVControlId, active: boolean): void {
    const cap = this.caps[id];
    if (active === cap.held) return;
    cap.held = active;
    if (this.reduced) {
      cap.value = active ? 0.35 : 0;
      cap.phase = active ? 'held' : 'idle';
      return;
    }
    if (active) {
      cap.from = cap.value;
      cap.elapsed = 0;
      cap.phase = 'down';
    } else if (cap.phase === 'held') {
      cap.from = cap.value;
      cap.elapsed = 0;
      cap.phase = 'up';
    }
    // A quick pointer/keyboard release still finishes the down + 50ms dwell.
  }

  step(delta: number): boolean {
    if (!this.moving || !Number.isFinite(delta) || delta <= 0) return false;
    if (this.latch !== this.latchTarget) {
      this.latchElapsed = Math.min(this.latchElapsed + delta, TV_HARDWARE_MOTION.latchSeconds);
      const progress = this.latchElapsed / TV_HARDWARE_MOTION.latchSeconds;
      this.latch = progress === 1 ? this.latchTarget
        : this.latchFrom + (this.latchTarget - this.latchFrom) * easeOut(progress);
    }
    for (const id of TV_CONTROL_IDS) this.advanceCap(this.caps[id], delta);
    return true;
  }

  reset(): void {
    for (const id of TV_CONTROL_IDS) {
      const cap = this.caps[id];
      cap.held = false;
      cap.phase = 'idle';
      cap.elapsed = cap.from = cap.value = 0;
    }
    this.latch = this.latchFrom = this.latchTarget;
    this.latchElapsed = TV_HARDWARE_MOTION.latchSeconds;
  }

  private advanceCap(cap: CapMotion, delta: number): void {
    let remaining = delta;
    while (remaining > 0 && cap.phase !== 'idle' && cap.phase !== 'held') {
      const duration = cap.phase === 'down' ? TV_HARDWARE_MOTION.downSeconds
        : cap.phase === 'hold' ? TV_HARDWARE_MOTION.minimumHoldSeconds
          : TV_HARDWARE_MOTION.upSeconds;
      const consumed = Math.min(remaining, duration - cap.elapsed);
      cap.elapsed += consumed;
      remaining -= consumed;
      const progress = Math.min(1, cap.elapsed / duration);
      if (cap.phase === 'down') cap.value = cap.from + (1 - cap.from) * easeOut(progress);
      if (cap.phase === 'up') cap.value = cap.from * (1 - easeOut(progress));
      if (progress < 1) break;
      cap.elapsed = 0;
      if (cap.phase === 'down') {
        cap.value = 1;
        cap.phase = 'hold';
      } else if (cap.phase === 'hold') {
        cap.from = 1;
        cap.phase = cap.held ? 'held' : 'up';
      } else {
        cap.value = 0;
        cap.phase = 'idle';
      }
    }
  }
}
