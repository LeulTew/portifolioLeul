import { describe, expect, it } from 'vitest';
import { centeredHeading, type HeadingMetrics } from './headingGeometry';

const metrics: HeadingMetrics = {
  viewportWidth: 1440, viewportHeight: 900, left: 166, top: 99,
  titleWidth: 496, titleHeight: 99, subtitleWidth: 720, subtitleHeight: 27,
  subtitleTop: 119,
};

describe('large centered About composition', () => {
  it('centers the title and subtitle independently', () => {
    const pose = centeredHeading(metrics);
    expect(metrics.left + pose.titleX + metrics.titleWidth * pose.scale / 2).toBe(720);
    expect(metrics.left + pose.subtitleX + metrics.subtitleWidth / 2).toBe(720);
    expect(pose.scale).toBe(1.45);
  });

  it('centers the complete group vertically with a deliberate gap', () => {
    const pose = centeredHeading(metrics);
    const titleTop = metrics.top + pose.titleY;
    const subtitleTop = metrics.top + metrics.subtitleTop + pose.subtitleY;
    expect(subtitleTop - titleTop - metrics.titleHeight * pose.scale).toBeCloseTo(24);
    expect((titleTop + subtitleTop + metrics.subtitleHeight) / 2).toBeCloseTo(450);
  });

  it('fits a narrow viewport without horizontal overflow', () => {
    const narrow = { ...metrics, viewportWidth: 390, titleWidth: 300, subtitleWidth: 342 };
    const pose = centeredHeading(narrow);
    expect(pose.scale).toBeGreaterThan(1);
    expect(narrow.left + pose.titleX).toBeCloseTo(24);
    expect(narrow.left + pose.titleX + narrow.titleWidth * pose.scale).toBeCloseTo(366);
  });
});
