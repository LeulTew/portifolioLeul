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
    summary: 'Python in Tera Site, C++ in 3D 8 Queens OpenGL, and TypeScript in Portfolio Leul.',
    process: ['Source', 'Logic', 'Execution'],
    textMotion: 'decode',
    inlineMotion: 'decode',
    composition: 'visual-right',
    camera: { x: 25, y: 0, scale: 1.04, roll: -3 },
  }],
  ['Frameworks & Web', {
    scene: 'interfaces',
    summary: 'React and Three.js in Portfolio Leul; ASP.NET and Entity Framework Core in Car Rental Platform.',
    process: ['Components', 'Connections', 'Experience'],
    textMotion: 'assemble',
    inlineMotion: 'assemble',
    composition: 'visual-left',
    camera: { x: -25, y: 1, scale: 1.04, roll: 3 },
  }],
  ['AI & Data Science', {
    scene: 'intelligence',
    summary: 'Amharic IR Improved explores language-aware search; Ignition turns goals into structured plans.',
    process: ['Data', 'Learning', 'Insight'],
    textMotion: 'focus',
    inlineMotion: 'focus',
    composition: 'visual-right',
    camera: { x: 24, y: -1, scale: 1.1, roll: -5 },
  }],
  ['Databases', {
    scene: 'data',
    summary: 'Relational schemas in Celestial Bodies Database; PostgreSQL-backed goal history in Ignition.',
    process: ['Structure', 'Query', 'Retrieve'],
    textMotion: 'scan',
    inlineMotion: 'type',
    composition: 'visual-left',
    camera: { x: -24, y: 2, scale: 1.04, roll: 5 },
  }],
  ['Tools & Design', {
    scene: 'design',
    summary: 'Tera Site connects Markdown, templates, and CLI tooling; Portfolio Leul applies visual design to interactive graphics.',
    process: ['Draw', 'Refine', 'Build'],
    textMotion: 'draw',
    inlineMotion: 'draw',
    composition: 'visual-right',
    camera: { x: 25, y: 0, scale: 1.1, roll: -4 },
  }],
  ['Professional Skills', {
    scene: 'delivery',
    summary: 'Team-based search work in Amharic IR Improved, alongside cross-platform development in Ethio Trading.',
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
