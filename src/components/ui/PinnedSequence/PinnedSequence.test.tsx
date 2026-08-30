import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PinnedSequence } from './PinnedSequence';
import { localProgress } from './localProgress';
import { setScrollProgress, resetScrollProgress } from '@/lib/scroll/scrollProgress';

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
