import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EducationRecord } from './EducationRecord';
import { EDUCATION_RECORDS } from './educationRecords';
import { createEducationReveal } from './educationReveal';

const reveals: ReturnType<typeof createEducationReveal>[] = [];

function mountRecord(position: number) {
  const { container } = render(
    <EducationRecord
      record={EDUCATION_RECORDS[position]}
      position={position}
      onWheel={() => {}}
      inactive={false}
      interactive={false}
    />
  );
  return container.querySelector<HTMLElement>('article')!;
}

function textPart(record: HTMLElement, role: string) {
  const element = record.querySelector<HTMLElement>(`[data-edu-role="${role}"]`);
  expect(element, `${record.getAttribute('aria-label')}: ${role}`).not.toBeNull();
  return element!;
}

afterEach(() => {
  reveals.splice(0).forEach(reveal => reveal.revert());
  cleanup();
});

it.each([
  { position: 0, motions: ['wipe', 'slide', 'fold'] },
  { position: 1, motions: ['press', 'fold', 'wipe', 'slide'] },
  { position: 2, motions: ['slide', 'wipe', 'decrypt', 'slide', 'wipe', 'decrypt'] },
  { position: 3, motions: ['wave', 'wipe'] },
])('varies individual course rows within record $position', ({ position, motions }) => {
  const record = mountRecord(position);
  expect(Array.from(
    record.querySelectorAll<HTMLElement>('[data-edu-role="course"]'),
    element => element.dataset.eduText
  )).toEqual(motions);
});

describe('institution-authored Education choreography', () => {
  it.each([
    { position: 0, award: 'fold', course: 'wipe', period: 'slide' },
    { position: 1, award: 'press', course: 'press', period: 'fold' },
    { position: 2, award: 'slide', course: 'slide', period: 'decrypt' },
    { position: 3, award: 'wave', course: 'wave', period: 'fold' },
  ])('gives record $position distinct treatments to its actual nested copy', ({
    position, award, course, period,
  }) => {
    const record = mountRecord(position);
    expect(textPart(record, 'award').dataset.eduText).toBe(award);
    expect(textPart(record, 'course').dataset.eduText).toBe(course);
    expect(textPart(record, 'period').dataset.eduText).toBe(period);
    const treatments = new Set(Array.from(
      record.querySelectorAll<HTMLElement>('[data-edu-role]:not([data-edu-role="title"])'),
      element => element.dataset.eduText
    ));
    expect(treatments.size).toBeGreaterThanOrEqual(4);
    expect(record.querySelectorAll('[data-edu-text="blur"]').length).toBeLessThanOrEqual(1);
  });

  it.each([-1, 1] as const)('renders different award trajectories in direction %i, not just different labels', direction => {
    const poses: string[] = [];
    for (let position = 0; position < EDUCATION_RECORDS.length; position++) {
      const record = mountRecord(position);
      const reveal = createEducationReveal(record, direction);
      reveals.push(reveal);
      reveal.seek(650);
      const word = textPart(record, 'award').querySelector<HTMLElement>('[data-edu-word]')!;
      const transform = word.style.transform;
      poses.push(transform);
      if (position === 0) expect(transform).toContain('rotateX(');
      if (position === 1) expect(transform).toContain('scale(');
      if (position === 2) {
        expect(transform).toContain('translateX(');
        expect(transform).toContain('skewX(');
      }
      if (position === 3) expect(transform).toContain('rotateZ(');
      expect(Number(word.style.opacity)).toBeLessThan(1);
    }
    expect(new Set(poses).size).toBe(EDUCATION_RECORDS.length);
  });

  it('counts the actual GPA without replacing its accessible value or its reserved width', () => {
    const record = mountRecord(0);
    const score = textPart(record, 'score-value');
    expect(score.dataset.eduText).toBe('count');
    const plain = score.querySelector<HTMLElement>('[data-edu-plain]')!;
    const paint = score.querySelector<HTMLElement>('[data-edu-cipher]')!;
    const reveal = createEducationReveal(record);
    reveals.push(reveal);
    reveal.seek(750);
    expect(plain.textContent).toBe('3.92');
    expect(plain).not.toHaveAttribute('aria-hidden');
    expect(paint).toHaveAttribute('aria-hidden', 'true');
    expect(Number(paint.textContent)).toBeGreaterThan(0);
    expect(Number(paint.textContent)).toBeLessThan(3.92);
    expect(paint.textContent).toMatch(/^\d\.\d{2}$/);
    reveal.seek(1000);
    expect(score.textContent).toBe('3.92');
    expect(paint.textContent).toBe('');
  });

  it('types Boot.dev build titles while scanning coursework, rather than decrypting every row', () => {
    const record = mountRecord(2);
    const projects = Array.from(record.querySelectorAll<HTMLElement>('[data-edu-role="project"]'));
    expect(projects).toHaveLength(4);
    expect(projects.every(project => project.dataset.eduText === 'type')).toBe(true);
    expect(textPart(record, 'course').dataset.eduText).toBe('slide');
    const reveal = createEducationReveal(record);
    reveals.push(reveal);
    reveal.seek(750);
    for (const project of projects) {
      const plain = Array.from(project.querySelectorAll('[data-edu-plain]'), word => word.textContent).join('');
      const paint = Array.from(project.querySelectorAll('[data-edu-cipher]'), word => word.textContent).join('');
      expect(paint.trim().length).toBeGreaterThan(0);
      expect(paint.trim().length).toBeLessThan(plain.length);
      expect(plain.startsWith(paint.trimEnd())).toBe(true);
    }
  });

  it.each([-1, 1] as const)('settles and removes every transient layer on all four records in direction %i', direction => {
    for (let position = 0; position < EDUCATION_RECORDS.length; position++) {
      const record = mountRecord(position);
      const originalText = record.textContent;
      const originals = Array.from(
        record.querySelectorAll<HTMLElement>('[data-edu-text], [data-edu-word], [data-edu-glyph]'),
        element => ({ element, css: element.style.cssText })
      );
      const reveal = createEducationReveal(record, direction);
      reveals.push(reveal);
      expect(reveal.duration).toBe(1000);
      expect(reveal.paused).toBe(true);
      reveal.seek(720);
      reveal.seek(1000);
      expect(reveal.progress).toBe(1);
      expect(record.querySelector('[data-edu-text-active]')).toBeNull();
      expect(record.textContent).toBe(originalText);
      for (const word of record.querySelectorAll<HTMLElement>('[data-edu-word]')) {
        expect(word.style.opacity).toBe('1');
      }
      reveal.seek(450);
      expect(originals.some(({ element, css }) => element.style.cssText !== css)).toBe(true);
      reveal.revert();
      expect(record.textContent).toBe(originalText);
      for (const { element, css } of originals) expect(element.style.cssText).toBe(css);
    }
  });
});
