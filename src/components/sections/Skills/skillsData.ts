import { cvData } from '@/data/cv';

export type SkillScene = 'languages' | 'interfaces' | 'intelligence' | 'data' | 'design' | 'delivery';

interface Presentation {
  scene: SkillScene;
  summary: string;
  process: readonly [string, string, string];
}

const presentations = new Map<string, Presentation>([
  ['Languages', {
    scene: 'languages',
    summary: 'From low-level logic to expressive interfaces. The right language for the problem.',
    process: ['Source', 'Logic', 'Execution'],
  }],
  ['Frameworks & Web', {
    scene: 'interfaces',
    summary: 'Component-driven interfaces, real-time graphics, and connected web applications.',
    process: ['Components', 'Connections', 'Experience'],
  }],
  ['AI & Data Science', {
    scene: 'intelligence',
    summary: 'Turning raw data into useful models, searchable knowledge, and clearer decisions.',
    process: ['Data', 'Learning', 'Insight'],
  }],
  ['Databases', {
    scene: 'data',
    summary: 'Relational thinking. Structured data, clear connections, and dependable persistence.',
    process: ['Structure', 'Query', 'Retrieve'],
  }],
  ['Tools & Design', {
    scene: 'design',
    summary: 'From first sketch to versioned code. Visual precision meets a practical toolchain.',
    process: ['Draw', 'Refine', 'Build'],
  }],
  ['Professional Skills', {
    scene: 'delivery',
    summary: 'Break down the problem. Work together. Build across platforms.',
    process: ['Understand', 'Collaborate', 'Deliver'],
  }],
]);

export const SKILL_CHAPTERS = cvData.skills.map(category => {
  const presentation = presentations.get(category.title);
  if (!presentation) throw new Error(`Skills needs a visual for "${category.title}".`);
  return { ...category, ...presentation };
});

export type SkillChapter = (typeof SKILL_CHAPTERS)[number];

export const SKILLS_READING_MS = 1200;
export const SKILLS_REVEAL_SECONDS = 1.65;
export const SKILLS_CROSSING_SECONDS = 0.35;
export const SKILLS_STAGE_QUERY = '(min-width: 900px) and (min-height: 560px)';
