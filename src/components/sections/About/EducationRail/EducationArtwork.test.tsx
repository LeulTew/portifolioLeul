import { fireEvent, render, screen } from '@testing-library/react';
import type { MotionValue } from 'framer-motion';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EducationArtwork } from './EducationArtwork';

const springs = vi.hoisted(() => [] as MotionValue<number>[]);
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useSpring: (value: number) => {
      const spring = actual.useMotionValue(value);
      if (!springs.includes(spring)) springs.push(spring);
      return spring;
    },
  };
});

beforeEach(() => {
  springs.length = 0;
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

function setup(active = true) {
  const onWheel = vi.fn();
  const artwork = <svg role="img" aria-label="Institution" />;
  const view = render(<EducationArtwork active={active} onWheel={onWheel}>{artwork}</EducationArtwork>);
  const figure = screen.getByRole('img', { name: 'Institution' }).closest('figure')!;
  const measure = vi.spyOn(figure, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(100, 200, 200, 100));
  const move = (x: number, y: number, pointerType = 'mouse') => {
    fireEvent.pointerMove(figure, { clientX: x, clientY: y, pointerType });
  };
  const values = () => springs.map(spring => spring.get());
  return { ...view, figure, measure, move, values, onWheel, artwork };
}

describe('Education artwork interaction', () => {
  it('uses local, bounded tilt with one geometry read per pointer visit', () => {
    const { figure, measure, move, values } = setup();
    move(300, 200);
    expect(values()).toEqual([14, 14, 1.06]);
    move(900, -500);
    expect(values()).toEqual([14, 14, 1.06]);
    expect(measure).toHaveBeenCalledTimes(1);
    fireEvent.pointerLeave(figure);
    expect(values()).toEqual([0, 0, 1]);
    move(100, 300);
    expect(values()).toEqual([-14, -14, 1.06]);
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it('does not animate inactive records, touch input, or reduced/coarse-pointer motion', () => {
    const { rerender, artwork, onWheel, move, measure, values } = setup(false);
    move(300, 200);
    expect(measure).not.toHaveBeenCalled();
    rerender(<EducationArtwork active onWheel={onWheel}>{artwork}</EducationArtwork>);
    move(300, 200, 'touch');
    expect(measure).not.toHaveBeenCalled();
    vi.mocked(window.matchMedia).mockReturnValue({
      ...window.matchMedia(''),
      matches: false,
    });
    move(300, 200);
    expect(values()).toEqual([0, 0, 1]);
    expect(measure).not.toHaveBeenCalled();
  });

  it('resets before a crossing, recalculates after resize, and removes active listeners', () => {
    const { rerender, unmount, artwork, onWheel, move, measure, values } = setup();
    move(300, 200);
    fireEvent(window, new Event('resize'));
    expect(values()).toEqual([0, 0, 1]);
    move(300, 200);
    expect(measure).toHaveBeenCalledTimes(2);
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    rerender(<EducationArtwork active={false} onWheel={onWheel}>{artwork}</EducationArtwork>);
    expect(values()).toEqual([0, 0, 1]);
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    unmount();
  });

  it('forwards native wheel input without cancelling it', () => {
    const { figure, onWheel } = setup();
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
    fireEvent(figure, wheel);
    expect(onWheel).toHaveBeenCalledTimes(1);
    expect(wheel.defaultPrevented).toBe(false);
  });
});
