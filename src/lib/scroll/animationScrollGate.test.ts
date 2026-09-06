import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isAnimationBusy,
  startAnimation,
  endAnimation,
  subscribeAnimationBusy,
  emitScrollIntent,
  subscribeScrollIntent,
  setProgrammaticNavigation,
  isProgrammaticNavigation,
  initAnimationScrollGate,
  cleanupAnimationScrollGate,
  resetAnimationScrollGate,
} from './animationScrollGate';

describe('animationScrollGate', () => {
  beforeEach(() => {
    resetAnimationScrollGate();
    cleanupAnimationScrollGate();
  });

  afterEach(() => {
    resetAnimationScrollGate();
    cleanupAnimationScrollGate();
  });

  it('tracks busy state when animations start and end', () => {
    expect(isAnimationBusy()).toBe(false);

    const end1 = startAnimation('anim-1');
    expect(isAnimationBusy()).toBe(true);

    const end2 = startAnimation('anim-2');
    expect(isAnimationBusy()).toBe(true);

    end1();
    expect(isAnimationBusy()).toBe(true); // anim-2 still active

    end2();
    expect(isAnimationBusy()).toBe(false);

    startAnimation('anim-3');
    expect(isAnimationBusy()).toBe(true);
    endAnimation('anim-3');
    expect(isAnimationBusy()).toBe(false);
  });

  it('notifies busy subscribers on state transitions', () => {
    const listener = vi.fn();
    const unsub = subscribeAnimationBusy(listener);

    const end = startAnimation('test');
    expect(listener).toHaveBeenCalledWith(true);

    end();
    expect(listener).toHaveBeenCalledWith(false);

    unsub();
  });

  it('dispatches scroll intent to subscribers', () => {
    const listener = vi.fn();
    const unsub = subscribeScrollIntent(listener);

    emitScrollIntent('down');
    expect(listener).toHaveBeenCalledWith('down', undefined);

    emitScrollIntent('up');
    expect(listener).toHaveBeenCalledWith('up', undefined);

    unsub();
  });

  it('prevents default wheel events when animation is busy', () => {
    initAnimationScrollGate();

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 100,
      cancelable: true,
      bubbles: true,
    });

    const preventDefaultSpy = vi.spyOn(wheelEvent, 'preventDefault');

    // Not busy: does not prevent default
    window.dispatchEvent(wheelEvent);
    expect(preventDefaultSpy).not.toHaveBeenCalled();

    // Busy: prevents default
    const end = startAnimation('busy-anim');
    const busyWheelEvent = new WheelEvent('wheel', {
      deltaY: 100,
      cancelable: true,
      bubbles: true,
    });
    const busyPreventSpy = vi.spyOn(busyWheelEvent, 'preventDefault');

    window.dispatchEvent(busyWheelEvent);
    expect(busyPreventSpy).toHaveBeenCalled();

    end();
  });

  it('bypasses scroll interception when programmatic navigation is active', () => {
    initAnimationScrollGate();
    startAnimation('busy-anim');
    setProgrammaticNavigation(true);
    expect(isProgrammaticNavigation()).toBe(true);

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 100,
      cancelable: true,
      bubbles: true,
    });
    const preventSpy = vi.spyOn(wheelEvent, 'preventDefault');

    window.dispatchEvent(wheelEvent);
    expect(preventSpy).not.toHaveBeenCalled();

    setProgrammaticNavigation(false);
  });
});
