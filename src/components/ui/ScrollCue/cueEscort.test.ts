import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { CUE_FADE_SCREENS, CUE_REST_SCREENS, CUE_TIP_GAP, cueRail } from '@/lib/motion/heroPin';
import { centeredHeading } from '@/components/sections/About/headingGeometry';

describe('centered About title and its arrow escort', () => {
  it('keeps the measured gap from the centered arrival through the docked endpoint', () => {
    const pose = centeredHeading({
      viewportWidth: 1440, viewportHeight: 900, left: 166, top: 99,
      titleWidth: 496, titleHeight: 99, subtitleWidth: 720, subtitleHeight: 27,
      subtitleTop: 119,
    });
    const rail = cueRail(200, 1200, pose.originY, 315, 900);
    const tip = rail.top + rail.height - 1200;
    for (const progress of [0, 0.3, 0.7, 1]) {
      const displacement = (99 - pose.originY) * progress;
      expect(pose.originY + displacement - (tip + displacement)).toBeCloseTo(CUE_TIP_GAP);
    }
  });

  it('keeps the original responsive top inset on both title paints', () => {
    const css = readFileSync(join(__dirname, '../../sections/About/About.module.css'), 'utf-8');
    const header = /\.heldHeader \{([^}]+)\}/.exec(css)?.[1];
    expect(header).toContain('top: var(--head-lead)');
    expect(header).not.toContain('--head-travel');
    expect(header).not.toContain('transform:');
    expect(css).toMatch(/--head-lead:\s*clamp\(/);
  });

  it('composes both axes of the escort from the title movement on the same frame', () => {
    const css = readFileSync(join(__dirname, '../../sections/Home/Home.module.css'), 'utf-8');
    const cue = /\.scrollCue \{([^}]+)\}/.exec(css)?.[1];
    expect(cue).toContain('left: 0');
    expect(cue).toContain('transform: translate3d(');
    expect(cue).toContain('--cue-x');
    expect(cue).toContain('--cue-y');
    expect(cue).not.toContain('left: var(');
    expect(cue).toContain('--heading-origin-x');
    expect(cue).toContain('--heading-origin-y');
    expect(cue).toContain('--heading-rest-x');
    expect(cue).toContain('--heading-rest-y');
    expect(cue).toContain('--cue-heading-progress');
  });

  it('measures the resolved title inset rather than inventing a centered destination', () => {
    const home = readFileSync(join(__dirname, '../../sections/Home/Home.tsx'), 'utf-8');
    expect(home).toContain('Number.parseFloat(headingStyle.top)');
    expect(home).not.toContain('window.innerHeight / 2 - headingHeight / 2');
    expect(home).toContain('startX: sourceLeft - cueStartOffset');
    expect(home).toContain('endY: headingTop - CUE_TIP_GAP - height');
  });

  it('restores the historical resting distance', () => {
    expect(CUE_REST_SCREENS).toBe(0.14);
  });

  it('restores the historical fade distance', () => {
    expect(CUE_FADE_SCREENS).toBe(0.09);
  });

  it('preserves the original mint color rather than recoloring it in light mode', () => {
    const css = readFileSync(join(__dirname, 'ScrollCue.module.css'), 'utf-8');
    expect(/\.cue \{([^}]+)\}/.exec(css)?.[1]).toContain('color: #00ffc2');
    expect(css).not.toContain("[data-theme='light']");
    expect(css).not.toContain('color: #ffffff');
    expect(/\.current \{([^}]+)\}/.exec(css)?.[1]).toContain('stroke: currentColor');
  });
});
