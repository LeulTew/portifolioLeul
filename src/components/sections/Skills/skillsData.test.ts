import { describe, expect, it } from 'vitest';
import { cvData } from '@/data/cv';
import { projectsData } from '@/data/projects';
import { SKILL_CHAPTERS } from './skillsData';

const projectExamples: Record<string, number[]> = {
  Languages: [6, 17, 4],
  'Frameworks & Web': [4, 1],
  'AI & Data Science': [3, 23],
  Databases: [20, 23],
  'Tools & Design': [6, 4],
  'Professional Skills': [3, 2],
};

describe('Skills editorial content', () => {
  it('preserves all six categories, 35 skills, and authored motion identities', () => {
    expect(SKILL_CHAPTERS).toHaveLength(6);
    expect(SKILL_CHAPTERS.flatMap(chapter => chapter.items)).toHaveLength(35);
    expect(SKILL_CHAPTERS.map(({ title, items }) => ({ title, items }))).toEqual(cvData.skills);
    expect(new Set(SKILL_CHAPTERS.map(chapter => chapter.scene)).size).toBe(6);
    expect(new Set(SKILL_CHAPTERS.map(chapter => chapter.textMotion)).size).toBe(6);
    expect(new Set(SKILL_CHAPTERS.map(chapter => chapter.inlineMotion)).size).toBe(6);
  });

  it.each(SKILL_CHAPTERS)('grounds $title in named portfolio work without lengthening it into a case study', chapter => {
    const examples = projectExamples[chapter.title];
    expect(examples.length).toBeGreaterThan(0);
    for (const id of examples) {
      const project = projectsData.find(item => item.id === id);
      expect(project).toBeDefined();
      expect(chapter.summary).toContain(project!.title);
    }
    expect(chapter.summary.split(/\s+/).length).toBeLessThanOrEqual(24);
  });
});
