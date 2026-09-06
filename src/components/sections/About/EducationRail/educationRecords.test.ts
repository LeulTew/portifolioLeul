import { describe, it, expect } from 'vitest';
import { cvData } from '@/data/cv';
import { EDUCATION_RECORDS } from './educationRecords';

describe('EDUCATION_RECORDS', () => {
  it('carries every degree and every certification, and nothing invented', () => {
    expect(EDUCATION_RECORDS).toHaveLength(
      cvData.education.length + cvData.certifications.length
    );
  });

  it('reads the degrees first, so the set runs oldest qualification forward', () => {
    expect(EDUCATION_RECORDS[0].title).toBe(cvData.education[0].school);
    expect(EDUCATION_RECORDS[cvData.education.length].title).toBe(
      cvData.certifications[0].issuer
    );
  });

  it('keeps every line item from the source', () => {
    for (const entry of cvData.education) {
      const record = EDUCATION_RECORDS.find((r) => r.title === entry.school)!;
      expect(record.items).toEqual(entry.details);
      expect(record.award).toBe(entry.degree);
      expect(record.period).toBe(entry.period);
    }

    for (const entry of cvData.certifications) {
      const record = EDUCATION_RECORDS.find((r) => r.title === entry.issuer)!;
      expect(record.items).toEqual(entry.items);
      expect(record.summary).toBe(entry.description);
      expect(record.period).toBe(entry.year);
    }
  });

  it('tells a degree from a school leaving certificate', () => {
    // Both are education entries; only one of them is a degree, and the label
    // above the title is the only thing that says which.
    const degree = EDUCATION_RECORDS.find((r) => r.title === cvData.education[0].school)!;
    const secondary = EDUCATION_RECORDS.find((r) => r.title === cvData.education[1].school)!;
    expect(degree.kind).toBe('Degree');
    expect(secondary.kind).toBe('Secondary');
  });

  it('counts a certification set rather than restating its issuer', () => {
    const bootdev = EDUCATION_RECORDS.find((r) => r.title === 'Bootdev')!;
    expect(bootdev.kind).toBe('Certification');
    expect(bootdev.award).toBe(`${cvData.certifications[0].items.length} courses completed`);
  });

  it('gives every record a distinct key', () => {
    const ids = EDUCATION_RECORDS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
