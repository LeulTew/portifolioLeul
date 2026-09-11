import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
  /*
   * Spied per element rather than on `CSSStyleDeclaration.prototype`.
   *
   * A prototype spy catches every style write on the page, including GSAP's
   * ticker driving the Education rail's opening timeline -- which is a real
   * animation on its own clock and has every right to be writing. That made
   * this fail intermittently depending on where the rail happened to be, which
   * is the worst kind of test: it goes red for something it is not measuring.
   *
   * The claim here is narrow and worth pinning exactly: the nodes About writes
   * to on every frame must not be written to on a frame where nothing moved.
   */
  const watch = () => {
    const statements = screen
      .getByTestId('about-left-column')
      .closest<HTMLElement>('[data-contrary]')!;
    const overlay = screen.getByTestId('about-sequence-overlay');
    const about = document.getElementById('about')!;

    const calls: string[] = [];
    for (const [name, node] of [
      ['statements', statements],
      ['overlay', overlay],
      ['about', about],
    ] as const) {
      const style = node.style;
      const original = style.setProperty.bind(style);
      style.setProperty = (property: string, value: string | null, priority?: string) => {
        // `--seq` on the overlay is the harness standing in for the scroll store.
        if (!(name === 'overlay' && property === '--seq')) {
          calls.push(`${name}:${property}`);
        }
        return original(property, value, priority);
      };
      const setAttr = node.setAttribute.bind(node);
      node.setAttribute = (attribute: string, value: string) => {
        calls.push(`${name}:@${attribute}`);
        return setAttr(attribute, value);
      };
    }
    return calls;
  };

  const publish = async () => {
    window.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  const settleAt = async (seq: string) => {
    screen
      .getByTestId('about-sequence-overlay')
      .style.setProperty('--seq', seq);
    await publish();
  };

  it.each([
    ['before the statements', '0.20'],
    ['mid handover', '0.42'],
    ['statement two settled', '0.60'],
    ['statements cleared', '0.78'],
    ['fully green', '0.95'],
  ])('writes nothing on a repeat frame %s', async (_name, seq) => {
    render(<About />);
    await settleAt(seq);

    // Everything real happened on the frame above. This one must be free.
    const calls = watch();
    await publish();

    expect(calls).toEqual([]);
  });

  it('writes nothing across many still frames in a row', async () => {
    render(<About />);
    await settleAt('0.60');

    const calls = watch();
    for (let frame = 0; frame < 30; frame++) {
      window.dispatchEvent(new Event('scroll'));
    }
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).toEqual([]);
  });

  it('does write when the reader actually moves', async () => {
    // The guard must not be so eager that the section stops animating.
    render(<About />);
    await settleAt('0.40');

    const calls = watch();
    await settleAt('0.44');

    expect(calls.length).toBeGreaterThan(0);
  });
});
