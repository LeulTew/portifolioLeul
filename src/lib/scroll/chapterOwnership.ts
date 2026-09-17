export const CHAPTER_OWNERSHIP_ATTRIBUTES = [
  'data-sequence-active', 'data-education-active', 'data-skills-active', 'data-projects-active',
];

export function hasChapterOwnership(section: HTMLElement): boolean {
  return section.dataset.sequenceActive === 'true' || section.dataset.educationActive === 'true' ||
    section.dataset.skillsActive === 'true' || section.dataset.projectsActive === 'true';
}
