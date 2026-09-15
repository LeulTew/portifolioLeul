import { describe, expect, it } from 'vitest';
import { SKILL_CHAPTERS } from './skillsData';
import { getMaterialGeometry, LEARNING_LINKS, LEARNING_NODES, projectMaterialPoint } from './skillGeometry';

const commands = (path: string) => path.match(/[a-z]/gi);
const coordinates = (path: string) => path.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];

describe('one reconfigurable Skills material', () => {
  it.each(['full', 'economy'] as const)('authors six distinct, topology-compatible %s surfaces', quality => {
    const poses = SKILL_CHAPTERS.map(chapter => getMaterialGeometry(chapter.scene, quality));
    expect(new Set(poses.map(pose => pose.shell)).size).toBe(6);
    for (const pose of poses) {
      expect(commands(pose.shell)).toEqual(commands(poses[0].shell));
      expect(coordinates(pose.shell)).toHaveLength(coordinates(poses[0].shell).length);
      expect(commands(pose.panel)).toEqual(commands(poses[0].panel));
      expect(coordinates(pose.panel)).toHaveLength(coordinates(poses[0].panel).length);
      expect(coordinates(pose.shell).every(Number.isFinite)).toBe(true);
      expect(pose.shell).not.toMatch(/NaN|Infinity/);
    }
  });

  it('reduces contour work on low-tier devices without removing the morph or engraved meaning', () => {
    const full = getMaterialGeometry('intelligence');
    const economy = getMaterialGeometry('intelligence', 'economy');
    expect(coordinates(economy.shell).length).toBeLessThan(coordinates(full.shell).length);
    expect(economy.signals).toEqual(full.signals);
    expect(economy.depth).toBe(full.depth);
  });

  it('does not force the same ring housing onto unrelated skills', () => {
    expect(new Set(getMaterialGeometry('languages').inner.map(point => point.join(','))).size).toBe(1);
    expect(new Set(getMaterialGeometry('data').inner.map(point => point.join(','))).size).toBe(1);
    expect(getMaterialGeometry('intelligence').surfaceOpacity).toBe(0);
    expect(getMaterialGeometry('delivery').surfaceOpacity).toBe(0);
    expect(getMaterialGeometry('design').sharpness).toBe(1);
    expect(getMaterialGeometry('interfaces').sharpness).toBe(0);
    const inputs = getMaterialGeometry('intelligence').signals.map(signal => signal.points[0].join(','));
    expect(new Set(inputs).size).toBeGreaterThan(3);
  });

  it('keeps the same eight engraved paths while their meaning changes', () => {
    for (const chapter of SKILL_CHAPTERS) {
      const pose = getMaterialGeometry(chapter.scene);
      expect(pose.signals).toHaveLength(8);
      pose.signals.forEach(signal => {
        expect(commands(signal.d)).toEqual(['M', 'C']);
        expect(coordinates(signal.d)).toHaveLength(8);
        expect(signal.opacity).toBeGreaterThanOrEqual(0);
        expect(signal.opacity).toBeLessThanOrEqual(1);
      });
    }
  });

  it.each(['full', 'economy'] as const)('anchors every %s neural route to its visible neurons with weighted emphasis', quality => {
    const geometry = getMaterialGeometry('intelligence', quality);
    LEARNING_LINKS.forEach(({ from, to, weight }, index) => {
      const signal = geometry.signals[index];
      expect(signal.points[0]).toEqual(projectMaterialPoint('intelligence', LEARNING_NODES[from]));
      expect(signal.points[3]).toEqual(projectMaterialPoint('intelligence', LEARNING_NODES[to]));
      expect(signal.opacity).toBe(weight);
      expect(signal.points[0][0]).toBeLessThan(signal.points[1][0]);
      expect(signal.points[1][0]).toBeLessThan(signal.points[2][0]);
      expect(signal.points[2][0]).toBeLessThan(signal.points[3][0]);
    });
    expect(geometry.signals.filter(signal => signal.opacity === 1)).toHaveLength(2);
    expect(geometry.signals.every(signal => signal.opacity > 0)).toBe(true);
  });

  it('alternates spatial compositions and gives every capability an intentional type treatment', () => {
    expect(new Set(SKILL_CHAPTERS.map(chapter => chapter.textMotion)).size).toBe(6);
    SKILL_CHAPTERS.forEach((chapter, index) => {
      expect(chapter.composition).toBe(index % 2 ? 'visual-left' : 'visual-right');
      expect(Math.sign(chapter.camera.x)).toBe(index % 2 ? -1 : 1);
    });
  });
});
