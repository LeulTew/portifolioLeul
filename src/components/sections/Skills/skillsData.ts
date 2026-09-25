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
  /** One inspectable piece of the named work, pinned to a commit (round 11, D-UX-002). */
  proof: { label: string; claim: string; url: string; project: string };
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
    proof: {
      label: "Tera Site's Python title parser",
      claim: 'Extracts the first level-one Markdown heading, and raises an error when a page has none.',
      url: 'https://github.com/LeulTew/TeraSite/blob/8f7c6c1b75cb6791a2a016dea367412b7c9021d0/src/block_markdown.py#L165-L175',
      project: 'Tera Site',
    },
  }],
  ['Frameworks & Web', {
    scene: 'interfaces',
    summary: 'React and Three.js in Portfolio Leul; ASP.NET and Entity Framework Core in Car Rental Platform.',
    process: ['Components', 'Connections', 'Experience'],
    textMotion: 'assemble',
    inlineMotion: 'assemble',
    composition: 'visual-left',
    camera: { x: -25, y: 1, scale: 1.04, roll: 3 },
    proof: {
      label: "Car Rental's EF Core context",
      claim: "Extends ASP.NET Identity's context with cars, bookings, reviews, payments, favorites and vehicle versions.",
      url: 'https://github.com/LeulTew/CarRental-ThreeJS-MVC/blob/d6f8f89911df9ac5341e38b464bfb1c0a8d81c32/Carrental/Carrental/Models/CarContext.cs#L2-L17',
      project: 'Car Rental Platform',
    },
  }],
  ['AI & Data Science', {
    scene: 'intelligence',
    summary: 'Amharic IR Improved explores language-aware search; Ignition turns goals into structured plans.',
    process: ['Data', 'Learning', 'Insight'],
    textMotion: 'focus',
    inlineMotion: 'focus',
    composition: 'visual-right',
    camera: { x: 24, y: -1, scale: 1.1, roll: -5 },
    proof: {
      label: "Amharic IR's composite ranker",
      claim: 'Combines TF-IDF, position and proximity scores, normalizes for length, and returns each component.',
      url: 'https://github.com/LeulTew/amharic-ir-improved/blob/4096030543826b66370f9cc9ff35b6762b8e832c/core/ranker.py#L133-L150',
      project: 'Amharic IR Improved',
    },
  }],
  ['Databases', {
    scene: 'data',
    summary: 'Relational schemas in Celestial Bodies Database; PostgreSQL-backed goal history in Ignition.',
    process: ['Structure', 'Query', 'Retrieve'],
    textMotion: 'scan',
    inlineMotion: 'type',
    composition: 'visual-left',
    camera: { x: -24, y: 2, scale: 1.04, roll: 5 },
    proof: {
      label: "Ignition's PostgreSQL goal schema",
      claim: 'Each goal keeps its steps in one JSON column, so a goal and its plan return in one row.',
      url: 'https://github.com/LeulTew/Ignition/blob/dc5c5380ef1225ef11703da2858c03fbad269305/frontend/prisma/schema.prisma#L5-L18',
      project: 'Ignition',
    },
  }],
  ['Tools & Design', {
    scene: 'design',
    summary: 'Tera Site connects Markdown, templates, and CLI tooling; Portfolio Leul applies visual design to interactive graphics.',
    process: ['Draw', 'Refine', 'Build'],
    textMotion: 'draw',
    inlineMotion: 'draw',
    composition: 'visual-right',
    camera: { x: 25, y: 0, scale: 1.1, roll: -4 },
    proof: {
      label: "Tera Site's generation CLI",
      claim: 'Takes a base path, copies static assets, and generates every page through an HTML template.',
      url: 'https://github.com/LeulTew/TeraSite/blob/8f7c6c1b75cb6791a2a016dea367412b7c9021d0/src/main.py#L40-L58',
      project: 'Tera Site',
    },
  }],
  ['Professional Skills', {
    scene: 'delivery',
    summary: 'Team-based search work in Amharic IR Improved, alongside cross-platform development in Ethio Trading.',
    process: ['Understand', 'Collaborate', 'Deliver'],
    textMotion: 'connect',
    inlineMotion: 'reveal',
    composition: 'visual-left',
    camera: { x: -24, y: 0, scale: 1.09, roll: 2 },
    proof: {
      label: "Portfolio Leul's scroll contract",
      claim: 'Every rule the chapters follow names the reproducible defect that made it a rule.',
      url: 'https://github.com/LeulTew/portifolioLeul/blob/f5fa795cd7bac7b85e870d04948494156c47cae6/.claude/rules/scroll-choreography.md#L1-L14',
      project: 'Portfolio Leul',
    },
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
