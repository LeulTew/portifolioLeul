import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PinnedSequence } from './PinnedSequence';
import { localProgress } from './localProgress';
import { setScrollProgress, resetScrollProgress, subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { resetCameraHold } from '@/lib/camera/cameraHold';
import { isWorldOccluded, isFrameDrawn, resetFrameGate } from '@/lib/render/frameGate';

describe('localProgress', () => {
  it('is nothing before the stretch reaches the top of the screen', () => {
    expect(localProgress(800, 2400, 800)).toBe(0);
    expect(localProgress(10, 2400, 800)).toBe(0);
  });

  it('is complete once the whole stretch has been spent', () => {
    // Spent when the spacer's BOTTOM reaches the bottom of the screen, not
    // when it reaches the top: the last screenful is not scrolled through.
    expect(localProgress(-(2400 - 800), 2400, 800)).toBe(1);
    expect(localProgress(-3000, 2400, 800)).toBe(1);
  });

  it('runs evenly through the stretch', () => {
    expect(localProgress(-(2400 - 800) / 2, 2400, 800)).toBeCloseTo(0.5, 6);
  });

  it('handles a stretch no taller than the screen without dividing by zero', () => {
    expect(localProgress(0, 800, 800)).toBe(1);
    expect(localProgress(400, 800, 800)).toBe(0);
  });

  it('yields nothing rather than NaN on a bad measurement', () => {
    expect(localProgress(Number.NaN, 2400, 800)).toBe(0);
    expect(localProgress(0, 0, 800)).toBe(0);
    expect(localProgress(0, 2400, 0)).toBe(0);
  });
});

const LAYERS = [
  { name: 'one', start: 0.1, end: 0.45 },
  { name: 'two', start: 0.55, end: 0.9 },
];

describe('PinnedSequence world coverage', () => {
  beforeEach(() => {
    resetScrollProgress();
    resetCameraHold();
    resetFrameGate();
  });
  afterEach(() => resetCameraHold());
  const layers = [{ name: 'ground', start: 0, end: 1, feather: 0.1 }];
  const mount = () => {
    const rendered = render(
      <section id="about" data-head-travelling="true">
        <PinnedSequence layers={layers} occludesWorld><p>held</p></PinnedSequence>
      </section>
    );
    const spacer = screen.getByTestId('pinned-sequence');
    spacer.getBoundingClientRect = () => ({ top: -4000, bottom: -1600, height: 2400 }) as DOMRect;
    act(() => setScrollProgress(1));
    return rendered;
  };

  it('occludes the world while an opaque owed movement extends beyond the measured range', () => {
    mount();
    expect(screen.getByTestId('pinned-sequence-overlay')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('pinned-sequence-overlay').style.getPropertyValue('--ground-in')).toBe('1.000');
    expect(document.getElementById('about')).toHaveAttribute('data-sequence-active', 'true');
    expect(isWorldOccluded()).toBe(true);
    expect(isFrameDrawn(1)).toBe(false);
  });

  it('releases world coverage when the chapter completes without more scrolling', async () => {
    mount();
    expect(isWorldOccluded()).toBe(true);
    await act(async () => {
      const about = document.getElementById('about')!;
      about.removeAttribute('data-head-travelling');
      about.setAttribute('data-title-settled', 'true');
    });
    expect(isWorldOccluded()).toBe(false);
    expect(isFrameDrawn(2)).toBe(true);
    expect(document.getElementById('about')).not.toHaveAttribute('data-sequence-active');
  });

  it('releases world coverage on unmount', () => {
    const { unmount } = mount();
    expect(isWorldOccluded()).toBe(true);
    unmount();
    expect(isWorldOccluded()).toBe(false);
  });

  it('keeps drawing through a translucent boundary', () => {
    render(<PinnedSequence layers={layers} occludesWorld><p>held</p></PinnedSequence>);
    screen.getByTestId('pinned-sequence').getBoundingClientRect = () =>
      ({ top: -15, bottom: 2385, height: 2400 }) as DOMRect;
    act(() => setScrollProgress(0.1));
    expect(Number(screen.getByTestId('pinned-sequence-overlay').style.getPropertyValue('--ground-in')))
      .toBeLessThan(1);
    expect(isWorldOccluded()).toBe(false);
    expect(isFrameDrawn(1)).toBe(true);
  });
});

describe('PinnedSequence', () => {
  beforeEach(() => resetScrollProgress());

  it('reserves the scroll it spends, in screens', () => {
    render(
      <PinnedSequence screens={3} layers={LAYERS}>
        <p>held</p>
      </PinnedSequence>
    );
    expect(screen.getByTestId('pinned-sequence').style.height).toBe('300vh');
  });

  it('holds its contents outside the scrolling flow', () => {
    // Fixed inside a section would ride the scroll: every section here lives
    // in a transformed container, and that is what `fixed` resolves against.
    render(
      <PinnedSequence layers={LAYERS}>
        <p>held</p>
      </PinnedSequence>
    );
    const overlay = screen.getByTestId('pinned-sequence-overlay');
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay).toContainElement(screen.getByText('held'));
  });

  it('stays out of the way until the reader is inside it', () => {
    // An overlay fixed to the viewport covers every later section, so being
    // merely transparent is not enough.
    render(
      <PinnedSequence layers={LAYERS}>
        <p>held</p>
      </PinnedSequence>
    );
    expect(screen.getByTestId('pinned-sequence-overlay').dataset.active).toBe(
      'false'
    );
  });

  it('publishes a property per layer, without re-rendering to do it', () => {
    const rendered: number[] = [];
    function Counting() {
      rendered.push(1);
      return <p>held</p>;
    }

    render(
      <PinnedSequence layers={LAYERS}>
        <Counting />
      </PinnedSequence>
    );

    const spacer = screen.getByTestId('pinned-sequence');
    // Halfway through a three-screen stretch, with the layers straddling it.
    spacer.getBoundingClientRect = () =>
      ({ top: -800, bottom: 1600, height: 2400 }) as DOMRect;

    const before = rendered.length;
    act(() => setScrollProgress(0.5));

    const overlay = screen.getByTestId('pinned-sequence-overlay');
    expect(overlay.style.getPropertyValue('--seq')).not.toBe('');
    for (const layer of LAYERS) {
      expect(overlay.style.getPropertyValue(`--${layer.name}-in`)).not.toBe('');
      expect(overlay.style.getPropertyValue(`--${layer.name}-on`)).not.toBe('');
    }
    // The store publishes every frame; a re-render per frame to move two
    // numbers would re-render the whole section sixty times a second.
    expect(rendered.length).toBe(before);
  });

  it('keeps a layer at nothing while it is still on its way in', () => {
    render(
      <PinnedSequence layers={LAYERS}>
        <p>held</p>
      </PinnedSequence>
    );

    const spacer = screen.getByTestId('pinned-sequence');
    // Just inside the first layer's ramp.
    spacer.getBoundingClientRect = () =>
      ({ top: -(1600 * 0.13), bottom: 900, height: 2400 }) as DOMRect;
    act(() => setScrollProgress(0.2));

    const overlay = screen.getByTestId('pinned-sequence-overlay');
    const on = Number(overlay.style.getPropertyValue('--one-on'));
    const inValue = Number(overlay.style.getPropertyValue('--one-in'));

    expect(inValue).toBeGreaterThan(0);
    expect(on).toBeLessThan(0.1);
  });

  it('publishes a completed chapter return before consumers, even when a jump misses the pin', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeScrollProgress(() => {
      seen.push(overlay.style.getPropertyValue('--seq'));
    });
    render(
      <section id="about" data-title-settled="true" data-head-settled="true">
        <PinnedSequence layers={LAYERS}><p>held</p></PinnedSequence>
      </section>
    );
    const overlay = screen.getByTestId('pinned-sequence-overlay');
    const spacer = screen.getByTestId('pinned-sequence');
    const height = window.innerHeight * 3;
    spacer.getBoundingClientRect = () => ({
      top: window.innerHeight - height, bottom: window.innerHeight, height,
    }) as DOMRect;
    act(() => setScrollProgress(1));
    expect(overlay.style.getPropertyValue('--seq')).toBe('1.000');
    seen.length = 0;
    spacer.getBoundingClientRect = () => ({
      top: window.innerHeight * 1.35, bottom: window.innerHeight * 1.35 + height, height,
    }) as DOMRect;
    act(() => setScrollProgress(0));
    unsubscribe();
    expect(overlay.style.getPropertyValue('--seq')).toBe('0.000');
    expect(seen).toEqual(['0.000']);
  });
});

describe('PinnedSequence activation', () => {
  beforeEach(() => resetScrollProgress());

  const mount = () => {
    render(
      <PinnedSequence layers={LAYERS}>
        <p>held</p>
      </PinnedSequence>
    );
    return screen.getByTestId('pinned-sequence');
  };

  const activeAfter = (spacer: HTMLElement, rect: Partial<DOMRect>) => {
    spacer.getBoundingClientRect = () => rect as DOMRect;
    act(() => setScrollProgress(Math.random()));
    return screen.getByTestId('pinned-sequence-overlay').dataset.active;
  };

  it('stays off while the stretch is merely approaching', () => {
    // It intersects a whole screen before it reaches the top, and switching on
    // there lays the held content over whatever is still above it.
    const spacer = mount();
    expect(activeAfter(spacer, { top: 400, bottom: 2800, height: 2400 })).toBe(
      'false'
    );
  });

  it('holds only once the stretch has reached the top of the screen', () => {
    const spacer = mount();
    expect(activeAfter(spacer, { top: -400, bottom: 2000, height: 2400 })).toBe(
      'true'
    );
  });

  it('lets go once the stretch has been spent', () => {
    const spacer = mount();
    expect(activeAfter(spacer, { top: -2400, bottom: 0, height: 2400 })).toBe(
      'false'
    );
  });
});

describe('PinnedSequence pin extension', () => {
  /*
   * The pin is held past the spacer's end so a beat triggered near the end can
   * finish on screen, and About marks that with attributes on `#about`.
   *
   * The regression this covers: the list also read the `-settled` attributes,
   * which are set when a beat FINISHES and stay set for the rest of the page.
   * Past the stretch `rect.top <= 0` is permanently true as well, so the pin
   * never released -- and a fixed, full-screen overlay that never releases goes
   * on painting the held statements over Education and everything after it.
   */
  beforeEach(() => {
    resetScrollProgress();
    // `getElementById` returns the FIRST match, so a section left behind by an
    // earlier case would be the one every later case reads.
    document.querySelectorAll('#about').forEach((el) => el.remove());
  });
  afterEach(() => {
    document.querySelectorAll('#about').forEach((el) => el.remove());
  });

  const SPENT = { top: -2400, bottom: 0, height: 2400 } as Partial<DOMRect>;

  const mountWithAbout = () => {
    const about = document.createElement('section');
    about.id = 'about';
    document.body.appendChild(about);
    render(
      <PinnedSequence layers={LAYERS}>
        <p>held</p>
      </PinnedSequence>
    );
    return { about, spacer: screen.getByTestId('pinned-sequence') };
  };

  const activeWith = (
    spacer: HTMLElement,
    about: HTMLElement,
    attribute: string,
    rect: Partial<DOMRect>
  ) => {
    about.setAttribute(attribute, 'true');
    spacer.getBoundingClientRect = () => rect as DOMRect;
    act(() => setScrollProgress(Math.random()));
    const active = screen.getByTestId('pinned-sequence-overlay').dataset.active;
    about.removeAttribute(attribute);
    return active;
  };

  it.each([
    'data-bg-active',
    'data-title-active',
    'data-reverse-transition-active',
    // Not a beat in flight, but a chapter that still owes one: the green has
    // landed and the heading has not been rewritten yet.
    'data-bg-settled',
    'data-statements-cleared',
  ])('holds past the spacer while %s says the chapter is unfinished', (attribute) => {
    const { about, spacer } = mountWithAbout();
    expect(activeWith(spacer, about, attribute, SPENT)).toBe('true');
  });

  it('releases as soon as the chapter is finished', () => {
    /*
     * `data-title-settled` is the terminal state going down, and it is what
     * makes the hold safe to have: without a terminus, an overlay that is fixed
     * to the viewport and pinned on a sticky attribute covers every section
     * after it for the rest of the page -- which is exactly what it used to do,
     * with "Education" painted on top of Skills, Projects and Contact.
     */
    const { about, spacer } = mountWithAbout();
    about.setAttribute('data-bg-settled', 'true');
    about.setAttribute('data-statements-cleared', 'true');

    expect(activeWith(spacer, about, 'data-title-settled', SPENT)).toBe('false');
  });

  it('releases past the spacer when the chapter never started', () => {
    const { spacer } = mountWithAbout();
    spacer.getBoundingClientRect = () => SPENT as DOMRect;
    act(() => setScrollProgress(Math.random()));
    expect(screen.getByTestId('pinned-sequence-overlay').dataset.active).toBe(
      'false'
    );
  });

  it('holds through the gap between two serialised beats', () => {
    /*
     * The bug this exists for. The beats wait for each other, so between them
     * there are stretches where the chapter is unfinished and yet nothing is
     * animating. A reader who flicks crosses the whole spacer inside the first
     * of those gaps; if the pin keyed on "a beat is running" it released there,
     * and the two remaining movements played to nobody above the fold.
     */
    const { about, spacer } = mountWithAbout();
    about.setAttribute('data-statements-cleared', 'true');
    spacer.getBoundingClientRect = () => SPENT as DOMRect;
    act(() => setScrollProgress(Math.random()));

    expect(screen.getByTestId('pinned-sequence-overlay').dataset.active).toBe(
      'true'
    );
  });

  it('holds while the heading is still making its own journey', () => {
    /*
     * The heading's climb is the one beat that can still be running after every
     * other has finished, which is exactly what happens on the way back up: the
     * later beats reverse first, the chapter reads as done, and the overlay
     * retires on top of a heading that is four-fifths of the way home.
     *
     * Measured before the fix: the words vanished at travel 0.84 and the rest
     * of the movement played to a `visibility: hidden` element, with the hero's
     * mark drifting from 36px above them to 12px because its base had been
     * handed back to the scroll mid-escort.
     */
    const { about, spacer } = mountWithAbout();
    // Everything else is done -- the state the reverse ends in.
    about.setAttribute('data-title-settled', 'true');

    expect(activeWith(spacer, about, 'data-head-travelling', SPENT)).toBe('true');
  });

  it('switches the overlay off even after the observer has stopped asking', () => {
    /*
     * The leak that gave the hold no terminus.
     *
     * Turning the overlay off was the observer's job alone, and the observer is
     * edge-triggered: it asks whether the chapter is busy once, as the reader
     * crosses out of the spacer's neighbourhood, and never again. Leave during
     * a beat and it stays on for good -- "Education" painted across Skills,
     * Projects and Contact, which is the shape this bug kept coming back in.
     *
     * So the observer is driven here rather than left inert, because an inert
     * one cannot reproduce it: this only happens on the edge it declines to act
     * on.
     */
    const observers: IntersectionObserverCallback[] = [];
    const RealIO = global.IntersectionObserver;
    global.IntersectionObserver = class {
      root: Element | null = null;
      rootMargin = '';
      thresholds: ReadonlyArray<number> = [];
      constructor(callback: IntersectionObserverCallback) {
        observers.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
    } as unknown as typeof IntersectionObserver;

    try {
      const { about, spacer } = mountWithAbout();
      const overlay = screen.getByTestId('pinned-sequence-overlay');

      // Held, on screen, mid-beat.
      about.setAttribute('data-statements-cleared', 'true');
      spacer.getBoundingClientRect = () =>
        ({ top: -100, bottom: 2000, height: 2400 }) as DOMRect;
      act(() => setScrollProgress(Math.random()));
      expect(overlay.dataset.active).toBe('true');

      // The reader leaves while it is still mid-beat. The observer sees the
      // edge, finds the chapter busy, and declines to hide -- correctly.
      spacer.getBoundingClientRect = () => SPENT as DOMRect;
      act(() => {
        for (const fire of observers) {
          fire(
            [{ isIntersecting: false } as IntersectionObserverEntry],
            null as unknown as IntersectionObserver
          );
        }
      });
      expect(overlay.dataset.active).toBe('true');

      // The chapter now finishes, with the reader long gone and the observer
      // never going to fire again. The frame loop has to be the one to let go.
      about.removeAttribute('data-statements-cleared');
      act(() => setScrollProgress(Math.random()));

      expect(overlay.dataset.active).toBe('false');
    } finally {
      global.IntersectionObserver = RealIO;
    }
  });

  it('releases after the final completion without another scroll publication', async () => {
    const { about, spacer } = mountWithAbout();
    spacer.getBoundingClientRect = () => SPENT as DOMRect;
    about.setAttribute('data-statements-cleared', 'true');
    act(() => setScrollProgress(0.9));
    const overlay = screen.getByTestId('pinned-sequence-overlay');
    expect(overlay.dataset.active).toBe('true');
    await act(async () => {
      about.setAttribute('data-title-settled', 'true');
    });
    expect(overlay.dataset.active).toBe('false');
  });

  it('keeps an underlay through the Education-to-About handoff before title reversal starts', async () => {
    const { about, spacer } = mountWithAbout();
    spacer.getBoundingClientRect = () => ({ top: 2000, bottom: 4400, height: 2400 }) as DOMRect;
    const overlay = screen.getByTestId('pinned-sequence-overlay');
    await act(async () => {
      about.setAttribute('data-title-settled', 'true');
      about.setAttribute('data-education-returning', 'true');
    });
    expect(overlay.dataset.active).toBe('true');
    await act(async () => { about.removeAttribute('data-education-returning'); });
    expect(overlay.dataset.active).toBe('false');
  });

  it('tracks a spent position without covering an unfinished hero, then observes eligibility', async () => {
    render(<section id="home" />);
    const home = document.getElementById('home')!;
    const { about, spacer } = mountWithAbout();
    const overlay = screen.getByTestId('pinned-sequence-overlay');
    spacer.getBoundingClientRect = () => SPENT as DOMRect;
    about.setAttribute('data-head-pending', 'true');
    act(() => setScrollProgress(0.9));
    expect(overlay.dataset.active).toBe('false');
    expect(overlay.style.getPropertyValue('--seq')).toBe('1.000');
    await act(async () => { home.setAttribute('data-hero-handover-settled', 'true'); });
    expect(overlay.dataset.active).toBe('true');
    await act(async () => {
      about.removeAttribute('data-head-pending');
      about.setAttribute('data-title-settled', 'true');
    });
    expect(overlay.dataset.active).toBe('false');
  });

  it.each(['data-head-pending', 'data-head-settled', 'data-statements-present'])(
    'holds the gap before clearing on %s and observes its terminal release',
    async (flag) => {
      const { about, spacer } = mountWithAbout();
      spacer.getBoundingClientRect = () => SPENT as DOMRect;
      const overlay = screen.getByTestId('pinned-sequence-overlay');
      await act(async () => { about.setAttribute(flag, 'true'); });
      expect(overlay.dataset.active).toBe('true');
      await act(async () => { about.removeAttribute(flag); });
      expect(overlay.dataset.active).toBe('false');
    }
  );

  it('does not publish a position from a spacer it cannot measure', () => {
    /*
     * `localProgress` answers 0 for a zero-height spacer, and 0 is also a real
     * position -- the top of the stretch. Publishing it would tell a section
     * mid-chapter that the reader had jumped back to the beginning. Reachable
     * only since the pin started being held for the chapter rather than for the
     * spacer, because the overlay can now be active while the spacer is not
     * laid out.
     */
    const { about, spacer } = mountWithAbout();
    const overlay = screen.getByTestId('pinned-sequence-overlay');
    overlay.style.setProperty('--seq', '0.640');

    about.setAttribute('data-statements-cleared', 'true');
    spacer.getBoundingClientRect = () =>
      ({ top: 0, bottom: 0, height: 0 }) as DOMRect;
    act(() => setScrollProgress(Math.random()));

    expect(overlay.style.getPropertyValue('--seq')).toBe('0.640');
  });
});

describe('PinnedSequence cost', () => {
  beforeEach(() => resetScrollProgress());

  it('does not rewrite a property whose value has not changed', () => {
    // setProperty invalidates style whether or not the value differs, and this
    // runs every frame for the length of the stretch. A blur re-rasterises on
    // any change at all.
    render(
      <PinnedSequence layers={LAYERS}>
        <p>held</p>
      </PinnedSequence>
    );

    const spacer = screen.getByTestId('pinned-sequence');
    spacer.getBoundingClientRect = () =>
      ({ top: -800, bottom: 1600, height: 2400 }) as DOMRect;

    const overlay = screen.getByTestId('pinned-sequence-overlay');
    act(() => setScrollProgress(0.5));

    let writes = 0;
    const original = overlay.style.setProperty.bind(overlay.style);
    overlay.style.setProperty = (...args: Parameters<typeof original>) => {
      writes += 1;
      return original(...args);
    };

    // Same geometry, so every value rounds to what is already there.
    act(() => setScrollProgress(0.5001));
    expect(writes).toBe(0);
  });

  it('still writes when the value does move', () => {
    render(
      <PinnedSequence layers={LAYERS}>
        <p>held</p>
      </PinnedSequence>
    );

    const spacer = screen.getByTestId('pinned-sequence');
    spacer.getBoundingClientRect = () =>
      ({ top: -400, bottom: 2000, height: 2400 }) as DOMRect;
    act(() => setScrollProgress(0.3));
    const first = screen
      .getByTestId('pinned-sequence-overlay')
      .style.getPropertyValue('--seq');

    spacer.getBoundingClientRect = () =>
      ({ top: -1200, bottom: 1200, height: 2400 }) as DOMRect;
    act(() => setScrollProgress(0.7));
    const second = screen
      .getByTestId('pinned-sequence-overlay')
      .style.getPropertyValue('--seq');

    expect(second).not.toBe(first);
  });
});
