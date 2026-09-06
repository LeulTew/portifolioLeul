import { cvData } from '@/data/cv';

/**
 * Degrees and certifications read as one sequence on the rail.
 *
 * They were two grids before, which made the certifications look like an
 * afterthought stacked under the real thing. On a rail they are the same kind
 * of object -- a place, a span of time, and what came out of it -- so they are
 * flattened into one list here rather than at the markup.
 */
export interface EducationRecord {
  id: string;
  /** The short technical label carried above the title. */
  kind: string;
  title: string;
  /** What was earned. */
  award: string;
  /** Completed, or the year the certificates were issued. */
  period: string;
  /** One sentence, where the source has one. */
  summary: string;
  /** The line items, listed under the summary. */
  items: readonly string[];
  /**
   * The institution's own mark, where we have the real artwork for it.
   *
   * Only set for records whose logo has actually been supplied. The rest carry
   * no mark at all rather than an approximation: drawing a real school's badge
   * from memory misrepresents it.
   */
  logo?: 'hilcoe';
}

const CERTIFICATION_KIND = 'Certification';

export const EDUCATION_RECORDS: readonly EducationRecord[] = [
  ...cvData.education.map((entry): EducationRecord => ({
    id: entry.school,
    kind: entry.degree.toLowerCase().startsWith('bsc') ? 'Degree' : 'Secondary',
    title: entry.school,
    award: entry.degree,
    period: entry.period,
    summary: '',
    items: entry.details,
    ...(entry.school.startsWith('HiLCoE') ? { logo: 'hilcoe' as const } : {}),
  })),
  ...cvData.certifications.map((entry): EducationRecord => ({
    id: entry.issuer,
    kind: CERTIFICATION_KIND,
    title: entry.issuer,
    award: `${entry.items.length} ${entry.items.length === 1 ? 'course' : 'courses'} completed`,
    period: entry.year,
    summary: entry.description,
    items: entry.items,
  })),
];
