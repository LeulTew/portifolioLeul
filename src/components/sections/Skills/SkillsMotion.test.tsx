import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import { TiltedInstrument } from './SkillsMotion';

beforeEach(() => {
  document.documentElement.dataset.quality = 'high';
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
});

afterEach(() => {
  cleanup();
  gsap.ticker.sleep();
  delete document.documentElement.dataset.quality;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Skills instrument depth', () => {
  it('responds to an already-present mouse and refreshes bounds once after a resize', () => {
    const { container } = render(<TiltedInstrument enabled><svg /></TiltedInstrument>);
    const figure = container.querySelector('figure')!;
    const object = figure.firstElementChild!;
    const bounds = vi.spyOn(figure, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 0, 100, 100));
    const settle = () => {
      act(() => { gsap.getTweensOf(object).forEach(tween => tween.progress(1)); });
      gsap.ticker.sleep();
    };
    fireEvent.pointerMove(figure, { pointerType: 'mouse', clientX: 80, clientY: 50 });
    settle();
    expect(Number(gsap.getProperty(object, 'rotationY'))).toBeCloseTo(2.4);
    fireEvent.pointerMove(figure, { pointerType: 'mouse', clientX: 90, clientY: 50 });
    settle();
    expect(bounds).toHaveBeenCalledTimes(1);

    bounds.mockReturnValue(new DOMRect(0, 0, 200, 100));
    fireEvent(window, new Event('resize'));
    fireEvent.pointerMove(figure, { pointerType: 'mouse', clientX: 180, clientY: 50 });
    settle();
    expect(bounds).toHaveBeenCalledTimes(2);
    expect(Number(gsap.getProperty(object, 'rotationY'))).toBeCloseTo(3.2);
  });

  it('does not create depth tweens on the low-quality tier', () => {
    document.documentElement.dataset.quality = 'low';
    const { container } = render(<TiltedInstrument enabled><svg /></TiltedInstrument>);
    const figure = container.querySelector('figure')!;
    fireEvent.pointerMove(figure, { pointerType: 'mouse', clientX: 80, clientY: 50 });
    expect(gsap.getTweensOf(figure.firstElementChild)).toHaveLength(0);
    expect(figure.firstElementChild).not.toHaveAttribute('style');
  });
});
