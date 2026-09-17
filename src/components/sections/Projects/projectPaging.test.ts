import { describe, expect, it } from 'vitest';
import { ProjectWheelPaging, PROJECT_WHEEL_STEP_PX } from './projectPaging';

const event = (deltaY: number, deltaMode = 0, deltaX = 0) => ({ deltaX, deltaY, deltaMode });

describe('project paging is an input-distance decision, not an animation lock', () => {
  it('normalizes pixel, line and page wheels', () => {
    expect(new ProjectWheelPaging().take(event(48), 900)).toBe(1);
    expect(new ProjectWheelPaging().take(event(-3, 1), 900)).toBe(-1);
    expect(new ProjectWheelPaging().take(event(1, 2), 900)).toBe(1);
  });

  it('accepts successive meaningful events immediately without a clock or completion state', () => {
    const input = new ProjectWheelPaging();
    expect(Array.from({ length: 8 }, () => input.take(event(100), 900))).toEqual(Array(8).fill(1));
    expect(input.take(event(-100), 900)).toBe(-1);
  });

  it('accumulates trackpad travel and discards direction-change leftovers', () => {
    const input = new ProjectWheelPaging();
    for (let count = 0; count < 3; count++) expect(input.take(event(12), 900)).toBe(0);
    expect(input.take(event(12), 900)).toBe(1);
    expect(input.take(event(30), 900)).toBe(0);
    expect(input.take(event(-24), 900)).toBe(0);
    expect(input.take(event(-24), 900)).toBe(-1);
  });

  it('never banks a huge delta into later settling events', () => {
    const input = new ProjectWheelPaging();
    expect(input.take(event(20000), 900)).toBe(1);
    for (let count = 0; count < 20; count++) expect(input.take(event(1), 900)).toBe(0);
    expect(input.take(event(PROJECT_WHEEL_STEP_PX - 3), 900)).toBe(0);
    expect(input.take(event(3), 900)).toBe(1);
  });

  it('resets on explicit selection or Details and supports a horizontal trackpad', () => {
    const input = new ProjectWheelPaging();
    expect(input.take(event(24), 900)).toBe(0);
    input.reset();
    expect(input.take(event(24), 900)).toBe(0);
    expect(input.take(event(0, 0, -48), 900)).toBe(-1);
  });
});
