import { act } from '@testing-library/react';
import { vi } from 'vitest';

/** Drives the components' real rAF callbacks, including suspended-frame gaps. */
export function animationClock() {
  let now = 100;
  let nextId = 0;
  const pending = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));

  return {
    wait(ms: number) {
      now += ms;
    },
    async frame(ms = 10) {
      now += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      await act(async () => {
        callbacks.forEach((callback) => callback(now));
      });
    },
    async run(ms: number) {
      for (let elapsed = 0; elapsed < ms; elapsed += 10) {
        await this.frame(Math.min(10, ms - elapsed));
      }
    },
    get pending() {
      return pending.size;
    },
  };
}
