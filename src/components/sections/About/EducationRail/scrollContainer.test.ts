import { describe, it, expect, vi, afterEach } from 'vitest';
import { findScrollContainer, scrollContainerBy } from './scrollContainer';

function build(overflowY: string, scrollHeight: number, clientHeight: number) {
  const outer = document.createElement('div');
  const inner = document.createElement('div');
  outer.appendChild(inner);
  document.body.appendChild(outer);

  outer.style.overflowY = overflowY;
  Object.defineProperty(outer, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(outer, 'clientHeight', { value: clientHeight, configurable: true });

  return { outer, inner };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('findScrollContainer', () => {
  it('finds the ancestor that actually scrolls', () => {
    // The page scrolls inside drei's ScrollControls element rather than the
    // window, so a control that wants to move the reader has to find it.
    const { outer, inner } = build('auto', 4000, 800);
    expect(findScrollContainer(inner)).toBe(outer);
  });

  it('ignores an ancestor that could scroll but has nothing to scroll', () => {
    const { inner } = build('auto', 800, 800);
    expect(findScrollContainer(inner)).toBeNull();
  });

  it('ignores an overflowing ancestor that is not scrollable', () => {
    const { inner } = build('visible', 4000, 800);
    expect(findScrollContainer(inner)).toBeNull();
  });

  it('falls back to the window when the sections render straight into the page', () => {
    // With the 3D layer off there is no scroll container: the window is it.
    expect(findScrollContainer(null)).toBeNull();
  });
});

describe('scrollContainerBy', () => {
  it('moves the container it is given', () => {
    const { outer } = build('auto', 4000, 800);
    const scrollBy = vi.fn();
    outer.scrollBy = scrollBy;

    scrollContainerBy(outer, 320);
    expect(scrollBy).toHaveBeenCalledWith({ top: 320, behavior: 'smooth' });
  });

  it('falls back to setting scrollTop where scrollBy is unavailable', () => {
    const { outer } = build('auto', 4000, 800);
    (outer as unknown as { scrollBy: unknown }).scrollBy = undefined;
    outer.scrollTop = 100;

    scrollContainerBy(outer, 50);
    expect(outer.scrollTop).toBe(150);
  });

  it('moves the window when there is no container', () => {
    const scrollBy = vi.fn();
    vi.stubGlobal('scrollBy', scrollBy);
    window.scrollBy = scrollBy;

    scrollContainerBy(null, -200);
    expect(scrollBy).toHaveBeenCalledWith({ top: -200, behavior: 'smooth' });
  });

  it('does nothing for a step of nowhere', () => {
    const { outer } = build('auto', 4000, 800);
    const scrollBy = vi.fn();
    outer.scrollBy = scrollBy;

    scrollContainerBy(outer, 0);
    scrollContainerBy(outer, Number.NaN);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
