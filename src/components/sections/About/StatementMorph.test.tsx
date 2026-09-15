import type { CSSProperties } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatementMorph } from './StatementMorph';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('statement morph geometry', () => {
  const mount = (side: 'left' | 'right') => {
    let notifyResize = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('innerHeight', 900);
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notifyResize = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    const { unmount } = render(
      <div data-testid="column" style={{ '--seed-scale-x': '0.4' } as CSSProperties}>
        <StatementMorph side={side} />
      </div>
    );
    const column = screen.getByTestId('column');
    let width = 600;
    let height = 180;
    Object.defineProperties(column, {
      clientWidth: { configurable: true, get: () => width },
      clientHeight: { configurable: true, get: () => height },
    });
    return {
      column, unmount, disconnect,
      resize: (nextWidth = width, nextHeight = height) => {
        width = nextWidth;
        height = nextHeight;
        notifyResize();
      },
    };
  };

  it.each(['left', 'right'] as const)('matches the %s text opening to one unscaled square', side => {
    const { column, resize } = mount(side);
    resize();
    const number = (property: string) => parseFloat(column.style.getPropertyValue(property));
    expect(number('--seed-scale-x') * 600).toBeCloseTo(306, 2);
    expect(number('--seed-scale-y') * 180).toBeCloseTo(306, 2);
    expect(600 - number('--seed-inset-x')).toBe(306);
    expect(180 - 2 * number('--seed-inset-y')).toBe(306);
    expect(column.querySelector('svg')).toHaveAttribute('data-statement-morph', side);
    expect(column.querySelectorAll('[data-morph-plane]')).toHaveLength(4);
  });

  it('remeasures responsive copy and fonts without a frame loop or idle style writes', () => {
    const { column, resize } = mount('left');
    resize();
    const writes = vi.spyOn(column.style, 'setProperty');
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    resize();
    fireEvent(window, new Event('resize'));
    expect(writes).not.toHaveBeenCalled();
    expect(frames).not.toHaveBeenCalled();
    resize(400, 320);
    expect(column.style.getPropertyValue('--seed-scale-x')).toBe('0.72000');
    expect(column.style.getPropertyValue('--seed-scale-y')).toBe('0.90000');
    expect(column.style.getPropertyValue('--seed-inset-x')).toBe('112px');
    expect(column.style.getPropertyValue('--seed-inset-y')).toBe('16px');
  });

  it('restores owned geometry and stops observing on unmount', () => {
    const { column, resize, unmount, disconnect } = mount('right');
    resize();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(column.style.getPropertyValue('--seed-scale-x')).toBe('0.4');
    for (const property of ['--seed-scale-y', '--seed-inset-x', '--seed-inset-y']) {
      expect(column.style.getPropertyValue(property)).toBe('');
    }
    const writes = vi.spyOn(column.style, 'setProperty');
    fireEvent(window, new Event('resize'));
    expect(writes).not.toHaveBeenCalled();
  });

  it('does not publish invalid geometry while its parent has no layout box', () => {
    const { column, resize } = mount('left');
    resize(0, 0);
    expect(column.style.getPropertyValue('--seed-scale-x')).toBe('0.4');
    expect(column.style.getPropertyValue('--seed-scale-y')).toBe('');
    resize(600, 180);
    expect(column.style.getPropertyValue('--seed-scale-y')).toBe('1.70000');
  });
});
