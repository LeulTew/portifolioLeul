import { cvData } from '@/data/cv';

export type SkillScene = 'languages' | 'interfaces' | 'intelligence' | 'data' | 'design' | 'delivery';
export type SkillTextMotion = 'decode' | 'assemble' | 'focus' | 'scan' | 'draw' | 'connect';
export type SkillInlineMotion = 'decode' | 'assemble' | 'focus' | 'type' | 'draw' | 'reveal';

interface Presentation {
  scene: SkillScene;
  summary: string;
  process: readonly [string, string, string];
  textMotion: SkillTextMotion;
  inlineMotion: SkillInlineMotion;
  composition: 'visual-right' | 'visual-left';
  camera: { x: number; y: number; scale: number; roll: number };
}

const presentations = new Map<string, Presentation>([
  ['Languages', {
    scene: 'languages',
    summary: 'From low-level logic to expressive interfaces. The right language for the problem.',
    process: ['Source', 'Logic', 'Execution'],
    textMotion: 'decode',
    inlineMotion: 'decode',
    composition: 'visual-right',
    camera: { x: 25, y: 0, scale: 1.04, roll: -3 },
  }],
  ['Frameworks & Web', {
    scene: 'interfaces',
    summary: 'Component-driven interfaces, real-time graphics, and connected web applications.',
    process: ['Components', 'Connections', 'Experience'],
    textMotion: 'assemble',
    inlineMotion: 'assemble',
    composition: 'visual-left',
    camera: { x: -25, y: 1, scale: 1.04, roll: 3 },
  }],
  ['AI & Data Science', {
    scene: 'intelligence',
    summary: 'Turning raw data into useful models, searchable knowledge, and clearer decisions.',
    process: ['Data', 'Learning', 'Insight'],
    textMotion: 'focus',
    inlineMotion: 'focus',
    composition: 'visual-right',
    camera: { x: 24, y: -1, scale: 1.1, roll: -5 },
  }],
  ['Databases', {
    scene: 'data',
    summary: 'Relational thinking. Structured data, clear connections, and dependable persistence.',
    process: ['Structure', 'Query', 'Retrieve'],
    textMotion: 'scan',
    inlineMotion: 'type',
    composition: 'visual-left',
    camera: { x: -24, y: 2, scale: 1.04, roll: 5 },
  }],
  ['Tools & Design', {
    scene: 'design',
    summary: 'From first sketch to versioned code. Visual precision meets a practical toolchain.',
    process: ['Draw', 'Refine', 'Build'],
    textMotion: 'draw',
    inlineMotion: 'draw',
    composition: 'visual-right',
    camera: { x: 25, y: 0, scale: 1.1, roll: -4 },
  }],
  ['Professional Skills', {
    scene: 'delivery',
    summary: 'Break down the problem. Work together. Build across platforms.',
    process: ['Understand', 'Collaborate', 'Deliver'],
    textMotion: 'connect',
    inlineMotion: 'reveal',
    composition: 'visual-left',
    camera: { x: -24, y: 0, scale: 1.09, roll: 2 },
  }],
]);

export const SKILL_CHAPTERS = cvData.skills.map(category => {
  const presentation = presentations.get(category.title);
  if (!presentation) throw new Error(`Skills needs a visual for "${category.title}".`);
  return { ...category, ...presentation };
});

export type SkillChapter = (typeof SKILL_CHAPTERS)[number];

export const SKILLS_REVEAL_SECONDS = 1.65;
export const SKILLS_TRANSITION_SECONDS = 2;
export const SKILLS_STAGE_QUERY = '(min-width: 900px) and (min-height: 560px)';
