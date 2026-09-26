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
  /**
   * One inspectable piece of the named work, pinned to a commit (round 11,
   * D-UX-002): a line of source, or a commit whose diff shows a reviewed
   * design change (round 14).
   */
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
      claim: "Takes each page's title from its first level-one heading; a page without one stops the build instead of publishing untitled.",
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
      claim: "One EF Core context extends ASP.NET Identity's, so accounts, cars, bookings, payments and reviews share one database and its migrations.",
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
      claim: "Combines TF-IDF, position and proximity scores and returns each one with the total, so a result's rank can be explained.",
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
      label: "Portfolio Leul's reading-first redesign",
      claim: 'Review found the actions under a whole description; the redesign sets name and actions first, the title 232px higher.',
      url: 'https://github.com/LeulTew/portifolioLeul/commit/8d645c1b19ca42072d8eea80369ba124c2ddbb10',
      project: 'Portfolio Leul',
    },
  }],
  ['Professional Skills', {
    scene: 'delivery',
    summary: 'Co-authored search work in Amharic IR Improved; a written, defect-named engineering contract in Portfolio Leul.',
    process: ['Understand', 'Collaborate', 'Deliver'],
    textMotion: 'connect',
    inlineMotion: 'reveal',
    composition: 'visual-left',
    camera: { x: -24, y: 0, scale: 1.09, roll: 2 },
    proof: {
      label: "Amharic IR's evaluation harness",
      claim: 'Written by Leul in the six-author project: ten Amharic queries scored against ground truth for precision, recall and NDCG.',
      url: 'https://github.com/LeulTew/amharic-ir-improved/blob/3947a675152f0c29459509d3a8bde3a66f1213a1/tests/evaluation_script.py#L14-L86',
      project: 'Amharic IR Improved',
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

/** The id a chapter's article carries, so navigation can land on it. */
export const skillChapterId = (index: number) => `skills-${SKILL_CHAPTERS[index].scene}`;
