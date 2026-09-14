export const CHAPTER_OWNERSHIP_ATTRIBUTES = ['data-sequence-active', 'data-education-active'];

export function hasChapterOwnership(section: HTMLElement): boolean {
  return section.dataset.sequenceActive === 'true' || section.dataset.educationActive === 'true';
}
