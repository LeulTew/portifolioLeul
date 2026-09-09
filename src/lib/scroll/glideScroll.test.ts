import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { glideScrollTo, GLIDE_MS } from './glideScroll';

/**
 * A stand-in for the ScrollControls scrollport: a container with a real
 * scrollable range, whose `scrollTop` can be read and written.
 */
function makeContainer(scrollHeight = 11_592, clientHeight = 900) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight });
  let top = 0;
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = v;
    },
  });
  document.body.appendChild(el);
  return el;
}

describe('glideScrollTo', () => {
  let clock = 0;
  let frames: FrameRequestCallback[] = [];

  const runFrames = (count: number, msPerFrame = 16.7) => {
    for (let i = 0; i < count; i += 1) {
      clock += msPerFrame;
      const due = frames;
      frames = [];
      for (const cb of due) cb(clock);
    }
  };

  beforeEach(() => {
    clock = 0;
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  const now = () => clock;

  it('arrives exactly at the requested position', () => {
    const el = makeContainer();
    glideScrollTo(el, 8333, { now });

    runFrames(Math.ceil(GLIDE_MS / 16.7) + 2);

    expect(Math.round(el.scrollTop)).toBe(8333);
  });

  it('writes scrollTop directly rather than asking for a smooth scroll', () => {
    /*
     * The whole reason this exists. `scrollTo({ behavior: 'smooth' })` is inert
     * on the ScrollControls scrollport -- that container writes `scrollTop`
     * every frame for its own damping, and a script assignment cancels an
     * in-flight native smooth scroll, so the nav links moved nothing at all.
     */
    const el = makeContainer();
    const scrollTo = vi.fn();
    el.scrollTo = scrollTo as unknown as typeof el.scrollTo;

    glideScrollTo(el, 5000, { now });
    runFrames(20);

    expect(scrollTo).not.toHaveBeenCalled();
    expect(el.scrollTop).toBeGreaterThan(0);
  });

  it('eases rather than stepping linearly', () => {
    const el = makeContainer();
    glideScrollTo(el, 10_000, { now });

    // A quarter of the way through time, an ease-in-out has covered well under
    // a quarter of the distance.
    runFrames(Math.round(GLIDE_MS / 4 / 16.7));
    const quarter = el.scrollTop;

    expect(quarter).toBeGreaterThan(0);
    expect(quarter).toBeLessThan(10_000 * 0.25);
  });

  it('never scrolls past the end of the track', () => {
    const el = makeContainer(11_592, 900); // max scrollTop = 10692
    glideScrollTo(el, 99_999, { now });

    runFrames(Math.ceil(GLIDE_MS / 16.7) + 2);

    expect(el.scrollTop).toBe(10_692);
  });

  it('hands control back the moment the reader scrolls', () => {
    const el = makeContainer();
    glideScrollTo(el, 10_000, { now });

    runFrames(10);
    const interrupted = el.scrollTop;
    expect(interrupted).toBeGreaterThan(0);

    window.dispatchEvent(new Event('wheel'));
    runFrames(200);

    // Abandoned where it was, not carried on to the target.
    expect(el.scrollTop).toBe(interrupted);
  });

  it('can be cancelled by the caller, so a second link replaces the first', () => {
    const el = makeContainer();
    const first = glideScrollTo(el, 10_000, { now });

    runFrames(10);
    const atCancel = el.scrollTop;
    first.cancel();
    runFrames(200);

    expect(el.scrollTop).toBe(atCancel);
  });

  it('lands immediately when there is nowhere to travel', () => {
    const el = makeContainer();
    el.scrollTop = 4000;
    glideScrollTo(el, 4000, { now });

    expect(el.scrollTop).toBe(4000);
    expect(frames).toHaveLength(0);
  });

  it('stops listening for input once it has arrived', () => {
    const el = makeContainer();
    const remove = vi.spyOn(window, 'removeEventListener');

    glideScrollTo(el, 3000, { now });
    runFrames(Math.ceil(GLIDE_MS / 16.7) + 2);

    for (const type of ['wheel', 'touchstart', 'keydown']) {
      expect(remove).toHaveBeenCalledWith(type, expect.any(Function), expect.anything());
    }
    remove.mockRestore();
  });
});
