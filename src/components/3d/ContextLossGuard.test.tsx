/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextLossGuard, RESTORE_GRACE_MS } from './ContextLossGuard';

let contextLost = false;
const domElement = document.createElement('canvas');

vi.mock('@react-three/fiber', () => ({
  useThree: (selector?: (state: any) => unknown) => {
    const state = {
      gl: {
        domElement,
        getContext: () => ({ isContextLost: () => contextLost }),
      },
    };
    return selector ? selector(state) : state;
  },
}));

/**
 * A lost context is an event, not an exception -- nothing throws, and the
 * error boundary around the Canvas never hears about it. What the reader sees
 * is the whole site (the sections are DOM, inside drei's `Scroll html`) with
 * the world behind it gone.
 */
describe('ContextLossGuard', () => {
  beforeEach(() => {
    contextLost = false;
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const loseContext = () => {
    const event = new Event('webglcontextlost', { cancelable: true });
    domElement.dispatchEvent(event);
    return event;
  };

  it('cancels the loss event, which is what lets the browser restore it', () => {
    render(<ContextLossGuard onUnrecoverable={vi.fn()} />);

    expect(loseContext().defaultPrevented).toBe(true);
  });

  it('waits rather than tearing the world down the instant it is lost', () => {
    const onUnrecoverable = vi.fn();
    render(<ContextLossGuard onUnrecoverable={onUnrecoverable} />);

    loseContext();
    vi.advanceTimersByTime(RESTORE_GRACE_MS - 1);

    expect(onUnrecoverable).not.toHaveBeenCalled();
  });

  it('gives up once the context has stayed gone', () => {
    const onUnrecoverable = vi.fn();
    render(<ContextLossGuard onUnrecoverable={onUnrecoverable} />);

    loseContext();
    vi.advanceTimersByTime(RESTORE_GRACE_MS);

    expect(onUnrecoverable).toHaveBeenCalledTimes(1);
  });

  it('stands down when the context comes back', () => {
    const onUnrecoverable = vi.fn();
    render(<ContextLossGuard onUnrecoverable={onUnrecoverable} />);

    loseContext();
    domElement.dispatchEvent(new Event('webglcontextrestored'));
    vi.advanceTimersByTime(RESTORE_GRACE_MS * 2);

    expect(onUnrecoverable).not.toHaveBeenCalled();
  });

  it('notices a context that was already gone before it mounted', () => {
    // Firefox evicts on the creation of the ninth context, which can be this
    // canvas's own neighbour a frame earlier.
    contextLost = true;
    const onUnrecoverable = vi.fn();
    render(<ContextLossGuard onUnrecoverable={onUnrecoverable} />);

    vi.advanceTimersByTime(RESTORE_GRACE_MS);

    expect(onUnrecoverable).toHaveBeenCalledTimes(1);
  });

  it('stops listening once it unmounts', () => {
    const onUnrecoverable = vi.fn();
    const { unmount } = render(<ContextLossGuard onUnrecoverable={onUnrecoverable} />);

    loseContext();
    unmount();
    vi.advanceTimersByTime(RESTORE_GRACE_MS * 2);

    expect(onUnrecoverable).not.toHaveBeenCalled();
  });
});
