import { afterEach, describe, expect, it } from 'vitest';
import { createEducationReveal, EDUCATION_REVEAL_MS } from './educationReveal';
import styles from './EducationRail.module.css';

const reveals: ReturnType<typeof createEducationReveal>[] = [];

function fixture(rowCount: number) {
  const record = document.createElement('article');
  record.innerHTML = `
    <h3><span data-edu-glyph style="color: green">B</span><span data-edu-glyph>o</span></h3>
    <span data-part="kind"><span data-edu-text="decrypt"><span data-edu-plain>Certification</span>
      <span data-edu-cipher aria-hidden="true"></span></span></span>
    <div data-edu-art><span data-edu-piece>art</span></div>
    <span data-edu-rule></span>
    <svg><circle class="${styles.markReveal}" r="172"></circle>
      <circle class="${styles.markRim}" r="172"></circle></svg>
    <div class="${styles.sealDiscMotion}"></div>
    <div class="${styles.sealRingMotion}"></div>`;
  for (let index = 0; index < rowCount; index++) {
    const row = document.createElement('p');
    row.dataset.part = 'row';
    row.innerHTML = `<span data-edu-text="blur"><span data-edu-word>Course</span> <span data-edu-word>${index}</span></span>`;
    record.appendChild(row);
  }
  document.body.appendChild(record);
  return record;
}

afterEach(() => {
  reveals.splice(0).forEach(reveal => reveal.revert());
  document.body.replaceChildren();
});

describe('Education Anime.js reveal', () => {
  it('arrives the Boot.dev wrapper without taking over its hover-only image states', () => {
    const record = fixture(1);
    const brand = document.createElement('div');
    brand.dataset.eduBrand = '';
    brand.innerHTML = `
      <img data-edu-brand-white src="/images/education/bootdev-white.webp" alt="">
      <img data-edu-brand-color src="/images/education/bootdev-color.webp" alt="Boot.dev">`;
    record.appendChild(brand);
    const reveal = createEducationReveal(record);
    reveals.push(reveal);
    for (const time of [0, 760, 880, 1000]) {
      reveal.seek(time);
      for (const image of brand.querySelectorAll('img')) {
        expect(image.style.opacity).toBe('');
      }
    }
    expect(brand.style.opacity).toBe('1');
    expect(reveal.duration).toBe(1000);
  });

  it.each([1, 13, 40])('bounds %i rows, split type and artwork to the same one-second clock', rowCount => {
    const record = fixture(rowCount);
    const reveal = createEducationReveal(record);
    reveals.push(reveal);
    expect(reveal.duration).toBe(EDUCATION_REVEAL_MS);
    expect(reveal.composition).toBe(false);
    expect(reveal.paused).toBe(true);
    reveal.seek(500, true);
    expect(reveal.paused).toBe(true);
    expect(record.querySelector<HTMLElement>('[data-edu-glyph]')!.style.transform)
      .not.toContain('rotateX(0deg)');
    reveal.seek(EDUCATION_REVEAL_MS, true);
    expect(reveal.progress).toBe(1);
    expect(reveal.paused).toBe(true);
    for (const element of record.querySelectorAll<HTMLElement>('[data-edu-glyph], [data-part="row"], [data-edu-word]')) {
      expect(element.style.opacity).toBe('1');
    }
    expect(record.querySelector('[data-edu-text-active]')).toBeNull();
    expect(record.querySelector<HTMLElement>('[data-edu-glyph]')!.style.transform)
      .toContain('rotateX(0deg)');
    expect(record.querySelector(`.${styles.markReveal}`)).toHaveAttribute('r', '172');
  });

  it('reverses on the same clock and restores the original inline styles on disposal', () => {
    const record = fixture(4);
    const sibling = fixture(4);
    const glyph = record.querySelector<HTMLElement>('[data-edu-glyph]')!;
    const initial = glyph.style.cssText;
    const reveal = createEducationReveal(record);
    reveals.push(reveal);
    reveal.seek(EDUCATION_REVEAL_MS, true);
    reveal.seek(250, true);
    expect(Number(glyph.style.opacity)).toBeLessThan(1);
    expect(sibling.querySelector<HTMLElement>('[data-edu-glyph]')!.style.transform).toBe('');
    reveal.revert();
    expect(glyph.style.cssText).toBe(initial);
    expect(glyph.style.transform).toBe('');
    expect(glyph.style.opacity).toBe('');
    expect(record.querySelector(`.${styles.markReveal}`)).toHaveAttribute('r', '172');
  });

  it('keeps the title reveal visible after left-hand artwork enters, without extending the clock', () => {
    const record = fixture(4);
    record.dataset.markSide = 'left';
    const glyph = record.querySelector<HTMLElement>('[data-edu-glyph]')!;
    const reveal = createEducationReveal(record);
    reveals.push(reveal);

    reveal.seek(200, true);
    expect(glyph.style.opacity).toBe('0');
    reveal.seek(500, true);
    expect(Number(glyph.style.opacity)).toBeGreaterThan(0.1);
    expect(Number(glyph.style.opacity)).toBeLessThan(0.9);
    expect(glyph.style.transform).not.toContain('rotateX(0deg)');
    expect(reveal.duration).toBe(EDUCATION_REVEAL_MS);
    reveal.seek(EDUCATION_REVEAL_MS, true);
    for (const titleGlyph of record.querySelectorAll<HTMLElement>('[data-edu-glyph]')) {
      expect(titleGlyph.style.opacity).toBe('1');
      expect(titleGlyph.style.transform).toContain('rotateX(0deg)');
    }
  });

  it.each([-1, 1] as const)('animates all text treatments while sought in direction %i', direction => {
    const record = fixture(14);
    const reveal = createEducationReveal(record, direction);
    reveals.push(reveal);
    reveal.seek(600, true);
    expect(reveal.paused).toBe(true);
    for (const phrase of record.querySelectorAll<HTMLElement>('[data-edu-text="blur"]')) {
      expect(Number.parseFloat(phrase.style.filter.replace('blur(', ''))).toBeGreaterThan(0);
      for (const word of phrase.querySelectorAll<HTMLElement>('[data-edu-word]')) {
        expect(Number(word.style.opacity)).toBeLessThan(1);
        expect(word.style.transform).not.toBe('');
      }
    }
    expect(record.querySelector('[data-edu-text-active]')).not.toBeNull();
    expect(record.querySelector('[data-edu-plain]')?.textContent).toBe('Certification');
    expect(record.querySelector('[data-edu-cipher]')?.textContent).not.toBe('Certification');
    reveal.seek(1000, true);
    expect(record.querySelector('[data-edu-cipher]')?.textContent).toBe('');
    reveal.revert();
    for (const element of record.querySelectorAll<HTMLElement>('[data-edu-word], [data-edu-text]')) {
      expect(element.style.transform).toBe('');
      expect(element.style.filter).toBe('');
      expect(element.style.opacity).toBe('');
    }
  });

  it('bounds arrival painting on high-refresh displays without delaying the terminal frame', () => {
    const record = fixture(12);
    const reveal = createEducationReveal(record);
    reveals.push(reveal);
    reveal.seek(600);
    const glyph = record.querySelector<HTMLElement>('[data-edu-glyph]')!;
    const at600 = glyph.style.cssText;
    reveal.seek(604);
    expect(glyph.style.cssText).toBe(at600);
    reveal.seek(620);
    expect(glyph.style.cssText).not.toBe(at600);
    reveal.seek(999);
    reveal.seek(1000);
    expect(reveal.progress).toBe(1);
    expect(record.querySelector('[data-edu-text-active]')).toBeNull();
  });
});
