import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { About } from './About';

/**
 * What the section costs on a frame where nothing has changed.
 *
 * Every stage in About subscribes to `subscribeScrollProgress`, which publishes
 * from inside the R3F render loop -- so all of this work runs synchronously,
 * on every frame, for the whole page and not just for this section. That makes
 * the idle frame the one worth measuring: it is the overwhelming majority of
 * them, and it should cost nothing.
 *
 * It did not. `setProperty` and `setAttribute` both invalidate style for the
 * subtree whether or not the value differs, and `#about` is watched by
 * `body:has(#about[data-...])` selectors, so a redundant write there forces
 * those to be re-evaluated against the whole document. The stages were between
 * them re-declaring four custom properties and up to three attributes per
 * frame, to values that had not moved.
 *
 * Asserted as a count rather than as a duration because a duration measured in
 * jsdom means nothing, while "how many redundant DOM writes happen on a still
 * frame" is exactly the quantity that was wrong and is checkable anywhere.
 */
describe('what an idle frame costs', () => {
  let setProperty: ReturnType<typeof vi.spyOn>;
  let setAttribute: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setProperty = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
    setAttribute = vi.spyOn(Element.prototype, 'setAttribute');
  });
  afterEach(() => {
    setProperty.mockRestore();
    setAttribute.mockRestore();
  });

  /** Publishes a frame at the given position and counts what it wrote. */
  const frameAt = async (seq: string) => {
    const overlay = screen.getByTestId('about-sequence-overlay');
    overlay.style.setProperty('--seq', seq);
    setProperty.mockClear();
    setAttribute.mockClear();
    window.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      properties: setProperty.mock.calls.length,
      attributes: setAttribute.mock.calls.length,
    };
  };

  it.each([
    ['before the statements', '0.20'],
    ['mid handover', '0.42'],
    ['statement two settled', '0.60'],
    ['statements cleared', '0.78'],
    ['fully green', '0.95'],
  ])('writes nothing on a repeat frame %s', async (_name, seq) => {
    render(<About />);

    // First frame at this position does the real work.
    await frameAt(seq);
    // Every frame after it, with the reader still, must be free.
    const repeat = await frameAt(seq);

    expect(repeat.properties).toBe(0);
    expect(repeat.attributes).toBe(0);
  });

  it('writes nothing across many still frames in a row', async () => {
    render(<About />);
    await frameAt('0.60');

    const overlay = screen.getByTestId('about-sequence-overlay');
    setProperty.mockClear();
    setAttribute.mockClear();
    for (let frame = 0; frame < 30; frame++) {
      overlay.style.setProperty('--seq', '0.60');
      window.dispatchEvent(new Event('scroll'));
    }
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The 30 `--seq` writes above are the harness standing in for the scroll
    // store, so they are discounted; nothing the section itself owns may move.
    const written = setProperty.mock.calls as unknown as string[][];
    const own = written.filter((call) => call[0] !== '--seq');
    expect(own.length).toBe(0);
    expect(setAttribute.mock.calls.length).toBe(0);
  });

  it('does write when the reader actually moves', async () => {
    // The guard must not be so eager that the section stops animating.
    render(<About />);
    await frameAt('0.40');
    const moved = await frameAt('0.44');

    expect(moved.properties).toBeGreaterThan(0);
  });
});
