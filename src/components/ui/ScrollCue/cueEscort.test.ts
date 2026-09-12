import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { CUE_FADE_SCREENS, CUE_REST_SCREENS, CUE_TIP_GAP, cueRail } from '@/lib/motion/heroPin';

describe('f46b247 Home-to-About composition', () => {
  it('lands above the fixed heading instead of the removed centered arrival', () => {
    const rail = cueRail(200, 1200, 99, 315, 900);
    expect(rail.top + rail.height).toBe(1200 + 99 - CUE_TIP_GAP);
    expect(rail.top + rail.height).not.toBe(1200 + (900 - 93) / 2 - CUE_TIP_GAP);
  });

  it('keeps the original responsive top inset on both title paints', () => {
    const css = readFileSync(join(__dirname, '../../sections/About/About.module.css'), 'utf-8');
    const header = /\.heldHeader \{([^}]+)\}/.exec(css)?.[1];
    expect(header).toContain('top: var(--head-lead)');
    expect(header).not.toContain('--head-travel');
    expect(header).not.toContain('transform:');
    expect(css).toMatch(/--head-lead:\s*clamp\(/);
  });

  it('positions the arrow without a second heading-displacement animation', () => {
    const css = readFileSync(join(__dirname, '../../sections/Home/Home.module.css'), 'utf-8');
    const cue = /\.scrollCue \{([^}]+)\}/.exec(css)?.[1];
    expect(cue).toContain('translate3d(0, var(--cue-y, 100vh), 0)');
    expect(cue).not.toContain('--head-offset');
  });

  it('measures the resolved title inset rather than inventing a centered destination', () => {
    const home = readFileSync(join(__dirname, '../../sections/Home/Home.tsx'), 'utf-8');
    expect(home).toContain('Number.parseFloat(headingStyle.top)');
    expect(home).not.toContain('window.innerHeight / 2 - headingHeight / 2');
    expect(home).not.toContain('cueTargetRef');
  });

  it('restores the historical resting distance', () => {
    expect(CUE_REST_SCREENS).toBe(0.14);
  });

  it('restores the historical fade distance', () => {
    expect(CUE_FADE_SCREENS).toBe(0.09);
  });
});
