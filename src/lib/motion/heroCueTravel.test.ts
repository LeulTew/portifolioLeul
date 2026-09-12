import { describe, expect, it } from 'vitest';
import { advanceCue, cueRail, cueTravel, CUE_DRAW_MS, CUE_TIP_GAP } from './heroPin';
import { PHASE_AT_REST } from './triggeredPhase';

describe('the original hero-to-About journey', () => {
  it('starts below the hero and lands at the same measured heading gap', () => {
    const rail = cueRail(700, 1080, 400, 280, 800);
    expect(cueTravel(rail.top, 1080, 280, 0)).toBe(712);
    expect(cueTravel(rail.top, 1080, 280, 1) + rail.height).toBeCloseTo(400 - CUE_TIP_GAP);
  });

  it('does not spend a suspended frame or a flick in one paint', () => {
    const next = advanceCue(PHASE_AT_REST, 1, 60000);
    expect(next.t).toBeCloseTo(50 / CUE_DRAW_MS);
  });

  it('stops at the requested spatial position rather than drawing into an unseen section', () => {
    let phase = PHASE_AT_REST;
    for (let frame = 0; frame < 80; frame++) phase = advanceCue(phase, 0.25, 16.7);
    expect(phase.t).toBe(0.25);
    expect(advanceCue(phase, 0.25, 16.7).t).toBe(0.25);
  });

  it('retracts through the same positions without snapping to the current scroll offset', () => {
    const forward = advanceCue({ t: 0.5, heading: 1 }, 1, 50);
    const reverse = advanceCue(forward, 0, 50);
    expect(reverse.t).toBeCloseTo(0.5);
    expect(cueTravel(900, 1200, 315, reverse.t)).toBeCloseTo(cueTravel(900, 1200, 315, 0.5));
  });
});
