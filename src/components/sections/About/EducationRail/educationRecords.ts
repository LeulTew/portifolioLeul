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
  logo?: 'hilcoe' | 'saint-joseph';
  /**
   * Which side of the record the mark sits on.
   *
   * Not a formatting whim: the two marks are meant to read as two
   * institutions rather than one template, and where they sit is the first
   * thing the eye registers about a record. HiLCoE's badge closes its record;
   * Saint Joseph's seal leads its own.
   */
  markSide?: 'left' | 'right';
}

/** The marks we hold real artwork for, keyed off the school's own name. */
function logoFor(
  school: string
): { logo?: EducationRecord['logo']; markSide?: EducationRecord['markSide'] } {
  if (school.startsWith('HiLCoE')) return { logo: 'hilcoe', markSide: 'right' };
  if (school.startsWith('Saint Joseph')) return { logo: 'saint-joseph', markSide: 'left' };
  return {};
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
    ...logoFor(entry.school),
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
