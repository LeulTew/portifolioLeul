import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EducationRecord } from './EducationRecord';
import { EDUCATION_RECORDS } from './educationRecords';
import { createEducationReveal, EDUCATION_SCAN_STEPS } from './educationReveal';
import {
  EDUCATION_TEXT_PROFILES, educationTextParts, educationTextStyle,
  type EducationTextMotion, type EducationTextRole, type EducationTextStyle,
} from './educationTextProfiles';

const reveals: ReturnType<typeof createEducationReveal>[] = [];
const FAMILY_POOLS = {
  fold: ['fold', 'slide', 'count'],
  letterpress: ['press', 'wipe'],
  decode: ['type', 'decrypt', 'scan'],
  flow: ['wave', 'blur'],
} as const satisfies Record<EducationTextStyle, readonly EducationTextMotion[]>;
const PROFILE_STYLES = Object.keys(FAMILY_POOLS) as EducationTextStyle[];
const TEXT_ROLES: EducationTextRole[] = [
  'title', 'institution', 'award', 'kind', 'period-label', 'period', 'summary',
  'build-group', 'course-group', 'project', 'course', 'date', 'score-label', 'score-value', 'score-scale',
];

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

function clipInsets(element: HTMLElement) {
  expect(element.style.clipPath).toMatch(/^inset\(/);
  return element.style.clipPath.match(/[\d.]+/g)!.map(Number);
}

function expectExclusivePools(pools: ReadonlyMap<EducationTextStyle, readonly string[]>) {
  for (const [style, motions] of pools) {
    expect(new Set(motions), style).toEqual(new Set(FAMILY_POOLS[style]));
    for (const [other, otherMotions] of pools) {
      if (other === style) continue;
      expect(motions.filter(motion => otherMotions.includes(motion)), `${style}/${other}`).toEqual([]);
    }
  }
}

afterEach(() => {
  reveals.splice(0).forEach(reveal => reveal.revert());
  cleanup();
});

it.each([
  { position: 0, motions: ['slide', 'fold', 'slide'] },
  { position: 1, motions: ['press', 'wipe', 'press', 'wipe'] },
  { position: 2, motions: ['scan', 'type', 'decrypt', 'scan', 'type', 'decrypt'] },
  { position: 3, motions: ['wave', 'blur'] },
])('varies individual course rows within record $position', ({ position, motions }) => {
  const record = mountRecord(position);
  expect(Array.from(
    record.querySelectorAll<HTMLElement>('[data-edu-role="course"]'),
    element => element.dataset.eduText
  )).toEqual(motions);
});

describe('institution-authored Education choreography', () => {
  it('owns pairwise disjoint families across every profile role, including unrendered roles and course pools', () => {
    const pools = new Map<EducationTextStyle, EducationTextMotion[]>();
    for (const style of PROFILE_STYLES) {
      const profile = EDUCATION_TEXT_PROFILES[style];
      expect(Object.keys(profile).sort()).toEqual([...TEXT_ROLES].sort());
      const motions = Object.values(profile).flatMap(value => typeof value === 'string' ? [value] : [...value]);
      pools.set(style, motions);
      expect(motions.filter(motion => motion === 'count')).toHaveLength(style === 'fold' ? 1 : 0);
    }
    expectExclusivePools(pools);
  });

  it('uses only its owned families on every actual rendered role, group label, date and title', () => {
    const pools = new Map<EducationTextStyle, string[]>();
    for (let position = 0; position < EDUCATION_RECORDS.length; position++) {
      const record = mountRecord(position);
      const style = educationTextStyle(record.dataset.textStyle);
      const profile = EDUCATION_TEXT_PROFILES[style];
      const motions: string[] = [];
      let course = 0;
      for (const element of record.querySelectorAll<HTMLElement>('[data-edu-text]')) {
        const split = element.dataset.eduText === 'split';
        if (split) expect(element).toHaveAttribute('data-part', 'title');
        const role = split ? 'title' : element.dataset.eduRole as EducationTextRole;
        expect(TEXT_ROLES).toContain(role);
        const motion = split ? profile.title : element.dataset.eduText!;
        expect(motion, `${style}/${role}`).toBe(role === 'course'
          ? profile.course[course++ % profile.course.length] : profile[role]);
        motions.push(motion);
      }
      const parts = educationTextParts(record);
      expect(parts.length).toBe(motions.length - record.querySelectorAll('[data-edu-text="split"]').length);
      for (const part of parts) {
        expect(part.start).toBeGreaterThanOrEqual(400);
        expect(part.end).toBeLessThanOrEqual(1000);
        expect(part.end - part.start).toBeGreaterThanOrEqual(200);
      }
      pools.set(style, motions);
    }
    expectExclusivePools(pools);
  });

  it.each([
    { style: 'unknown', role: 'course', motion: 'scan', error: /Unknown Education text style/ },
    { style: 'decode', role: 'unknown', motion: 'scan', error: /Invalid Education text treatment/ },
    { style: 'decode', role: 'course', motion: 'unknown', error: /Invalid Education text treatment/ },
  ])('rejects invalid text metadata $style/$role/$motion explicitly', ({ style, role, motion, error }) => {
    const record = document.createElement('article');
    record.dataset.textStyle = style;
    const text = document.createElement('span');
    text.dataset.eduRole = role;
    text.dataset.eduText = motion;
    text.textContent = 'Original source';
    record.appendChild(text);
    expect(() => educationTextParts(record)).toThrow(error);
  });

  it.each([
    { position: 0, award: 'fold', course: 'slide', period: 'slide' },
    { position: 1, award: 'press', course: 'press', period: 'press' },
    { position: 2, award: 'scan', course: 'scan', period: 'decrypt' },
    { position: 3, award: 'wave', course: 'wave', period: 'wave' },
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
    expect(treatments).toEqual(new Set(FAMILY_POOLS[educationTextStyle(record.dataset.textStyle)]));
    expect(record.querySelectorAll('[data-edu-text="blur"]').length).toBeLessThanOrEqual(1);
  });

  it.each([-1, 1] as const)('keeps title families visually distinct despite split wrappers in direction %i', direction => {
    const poses: string[] = [];
    for (let position = 0; position < EDUCATION_RECORDS.length; position++) {
      const record = mountRecord(position);
      const title = record.querySelector<HTMLElement>('[data-part="title"]')!;
      const reveal = createEducationReveal(record, direction);
      reveals.push(reveal);
      reveal.seek(650);
      const glyphs = Array.from(title.querySelectorAll<HTMLElement>('[data-edu-glyph]'));
      if (position === 2) {
        expect(glyphs).toHaveLength(0);
        const decode = textPart(record, 'title');
        expect(decode).toHaveAttribute('data-edu-text', 'decrypt');
        expect(decode).toHaveAttribute('data-edu-text-active', direction > 0 ? 'forward' : 'reverse');
        const source = decode.querySelector('[data-edu-plain]')!.textContent;
        const cipher = decode.querySelector('[data-edu-cipher]')!.textContent;
        expect(cipher).not.toBe(source);
        expect(source).toBe('Boot.dev');
        poses.push(cipher!);
      } else {
        expect(title).toHaveAttribute('data-edu-text', 'split');
        if (direction < 0) glyphs.reverse();
        const glyph = glyphs[0];
        const transform = glyph.style.transform;
        expect(Number(glyph.style.opacity)).toBeGreaterThan(0);
        expect(Number(glyph.style.opacity)).toBeLessThan(1);
        if (position === 0) {
          expect(transform).toContain('rotateX(');
          expect(transform).not.toContain('rotateX(0deg)');
          expect(transform).toContain('%');
          expect(transform).not.toContain('scale(');
        } else if (position === 1) {
          expect(transform).toContain('scale(');
          expect(transform).not.toContain('rotateX(');
          expect(Number(glyphs[Math.floor(glyphs.length / 2)].style.opacity))
            .toBeGreaterThan(Number(glyph.style.opacity));
        } else {
          const y = (element: HTMLElement) => Number(element.style.transform.match(/translateY\(([-\d.]+)/)![1]);
          expect(y(glyph) * y(glyphs[1])).toBeLessThan(0);
          expect(transform).toContain('scale(');
          expect(transform).not.toContain('rotateX(');
        }
        poses.push(transform);
      }
      expect(record.querySelector('h3')).toHaveAttribute('aria-label', EDUCATION_RECORDS[position].title);
    }
    expect(new Set(poses).size).toBe(EDUCATION_RECORDS.length);
  });

  it.each([-1, 1] as const)('renders different award trajectories in direction %i, not just different labels', direction => {
    const poses: string[] = [];
    for (let position = 0; position < EDUCATION_RECORDS.length; position++) {
      const record = mountRecord(position);
      const reveal = createEducationReveal(record, direction);
      reveals.push(reveal);
      reveal.seek(650);
      const award = textPart(record, 'award');
      if (position === 2) {
        expect(award.querySelector('[data-edu-word]')).toBeNull();
        expect(award.style.transform).toBe('');
        expect(award.style.opacity).toBe('');
        expect(clipInsets(award)).toEqual(direction > 0 ? [0, 62.5, 0, 0] : [0, 0, 0, 62.5]);
        poses.push(award.style.clipPath);
        continue;
      }
      const word = award.querySelector<HTMLElement>('[data-edu-word]')!;
      const transform = word.style.transform;
      poses.push(transform);
      if (position === 0) expect(transform).toContain('rotateX(');
      if (position === 1) expect(transform).toContain('scale(');
      if (position === 3) expect(transform).toContain('rotateZ(');
      expect(Number(word.style.opacity)).toBeLessThan(1);
    }
    expect(new Set(poses).size).toBe(EDUCATION_RECORDS.length);
  });

  it.each([-1, 1] as const)('counts the actual GPA in direction %i without replacing its accessible value or its reserved width', direction => {
    const record = mountRecord(0);
    const score = textPart(record, 'score-value');
    expect(score.dataset.eduText).toBe('count');
    const plain = score.querySelector<HTMLElement>('[data-edu-plain]')!;
    const paint = score.querySelector<HTMLElement>('[data-edu-cipher]')!;
    const reveal = createEducationReveal(record, direction);
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
    expect(textPart(record, 'course').dataset.eduText).toBe('scan');
    expect(textPart(record, 'build-group').dataset.eduText).toBe('type');
    expect(textPart(record, 'course-group').dataset.eduText).toBe('decrypt');
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

  it('scans a single stationary phrase in bounded steps with exact endpoints and mirrored return geometry', () => {
    const forwardRecord = mountRecord(2);
    const reverseRecord = mountRecord(2);
    const forwardPhrase = textPart(forwardRecord, 'course');
    const reversePhrase = textPart(reverseRecord, 'course');
    const source = forwardPhrase.textContent;
    const part = educationTextParts(forwardRecord).find(part => part.element === forwardPhrase)!;
    const forward = createEducationReveal(forwardRecord, 1);
    const reverse = createEducationReveal(reverseRecord, -1);
    reveals.push(forward, reverse);
    expect(EDUCATION_SCAN_STEPS).toBeLessThanOrEqual(24);
    const samples = Array.from({ length: EDUCATION_SCAN_STEPS + 1 }, (_, step) => ({
      time: part.start + (part.end - part.start) * (step === EDUCATION_SCAN_STEPS ? 1 : (step + 0.2) / EDUCATION_SCAN_STEPS),
      hidden: 100 * (1 - step / EDUCATION_SCAN_STEPS),
    }));
    const poses: string[] = [];
    for (const sample of [...samples, ...[...samples].reverse()]) {
      forward.seek(sample.time);
      reverse.seek(sample.time);
      expect(clipInsets(forwardPhrase)).toEqual([0, sample.hidden, 0, 0]);
      expect(clipInsets(reversePhrase)).toEqual([0, 0, 0, sample.hidden]);
      for (const phrase of [forwardPhrase, reversePhrase]) {
        expect(phrase.style.transform).toBe('');
        expect(phrase.style.opacity).toBe('');
        expect(phrase.style.filter).toBe('');
        expect(phrase.childElementCount).toBe(0);
        expect(phrase.textContent).toBe(source);
        expect(phrase).not.toHaveAttribute('aria-hidden');
      }
      poses.push(forwardPhrase.style.clipPath);
    }
    expect(new Set(poses).size).toBe(EDUCATION_SCAN_STEPS + 1);
    const observer = new MutationObserver(() => {});
    observer.observe(forwardRecord, { attributes: true, childList: true, subtree: true });
    forward.seek(samples[0].time);
    forward.seek(samples[0].time);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
    for (const [reveal, phrase] of [[forward, forwardPhrase], [reverse, reversePhrase]] as const) {
      expect(reveal.paused).toBe(true);
      expect(reveal.composition).toBe(false);
      expect(reveal.duration).toBe(1000);
      reveal.seek(1000);
      expect(clipInsets(phrase)).toEqual([0, 0, 0, 0]);
      reveal.revert();
      expect(phrase.style.cssText).toBe('');
      expect(phrase.textContent).toBe(source);
    }
  });

  it('holds scan steps while Saint Joseph ink and HiLCoE assembly continue smooth word motion', () => {
    const scanRecord = mountRecord(2);
    const inkRecord = mountRecord(1);
    const assemblyRecord = mountRecord(0);
    const phrases = [
      textPart(scanRecord, 'course'),
      inkRecord.querySelector<HTMLElement>('[data-edu-role="course"][data-edu-text="wipe"]')!,
      textPart(assemblyRecord, 'course'),
    ];
    const records = [scanRecord, inkRecord, assemblyRecord];
    const subjects = records.map((record, index) => {
      const phrase = phrases[index];
      const part = educationTextParts(record).find(part => part.element === phrase)!;
      const reveal = createEducationReveal(record);
      reveals.push(reveal);
      return { phrase, part, reveal };
    });
    const poses = [0.27, 0.34].map(progress => subjects.map(({ phrase, part, reveal }) => {
      reveal.seek(part.start + (part.end - part.start) * progress);
      return {
        clip: phrase.style.clipPath,
        words: Array.from(phrase.querySelectorAll<HTMLElement>('[data-edu-word]'), word => ({
          clip: word.style.clipPath, transform: word.style.transform,
        })),
      };
    }));
    expect(poses[0][0]).toEqual(poses[1][0]);
    expect(clipInsets(phrases[0])).toEqual([0, 75, 0, 0]);
    expect(poses[0][0].words).toEqual([]);
    expect(poses[0][1].clip).toBe('');
    expect(poses[0][1].words.length).toBeGreaterThan(1);
    expect(poses[0][1].words[0].clip).not.toBe(poses[1][1].words[0].clip);
    expect(poses[0][1].words[0].transform).toContain('translateX(');
    expect(poses[0][2].clip).toBe('');
    expect(poses[0][2].words[0].clip).toBe('');
    expect(poses[0][2].words[0].transform).toContain('skewX(');
    expect(poses[0][2].words[0].transform).not.toBe(poses[1][2].words[0].transform);
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
      for (const phrase of record.querySelectorAll<HTMLElement>('[data-edu-text="scan"]')) {
        expect(clipInsets(phrase)).toEqual([0, 0, 0, 0]);
        expect(phrase.style.transform).toBe('');
      }
      reveal.seek(450);
      expect(originals.some(({ element, css }) => element.style.cssText !== css)).toBe(true);
      reveal.revert();
      expect(record.textContent).toBe(originalText);
      for (const { element, css } of originals) expect(element.style.cssText).toBe(css);
    }
  });
});
