import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import postcss from 'postcss';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EducationRecord } from './EducationRecord';
import { EDUCATION_RECORDS } from './educationRecords';
import styles from './EducationRail.module.css';

afterEach(cleanup);

const bootdev = EDUCATION_RECORDS[2];
const bootSelector = ".record[data-provider='bootdev']";
const css = postcss.parse(readFileSync(join(__dirname, 'EducationRail.module.css'), 'utf8'));

function declarations(selector: string, property: string) {
  const values: string[] = [];
  css.walkRules(selector, rule => {
    rule.walkDecls(property, declaration => { values.push(declaration.value); });
  });
  return values;
}

function renderBootdev() {
  return render(
    <EducationRecord
      record={bootdev}
      position={2}
      onWheel={vi.fn()}
      inactive={false}
      interactive={true}
    />
  );
}

describe('Boot.dev editorial record', () => {
  it('keeps the existing title, award, period, summary and every dated item', () => {
    const { container } = renderBootdev();
    expect(screen.getByRole('heading', { level: 3, name: 'Bootdev' })).toHaveTextContent('Boot.dev');
    const article = container.querySelector('article')!;
    expect(article.textContent).toContain(bootdev.award);
    expect(article.textContent).toContain(`Featured from ${bootdev.period}`);
    expect(article.textContent).toContain(bootdev.summary);
    expect(article.querySelector('time')).toHaveAttribute('dateTime', bootdev.period);
    expect(Array.from(article.querySelectorAll('li'), item => item.textContent).sort())
      .toEqual([...bootdev.items].sort());
  });

  it('groups the readable summary with the main plate instead of isolating it above the courses', () => {
    const { container } = renderBootdev();
    const summary = container.querySelector('[data-edu-role="summary"]')!;
    const title = screen.getByRole('heading', { level: 3, name: 'Bootdev' });
    expect(summary.closest(`.${styles.plate}`)).toBe(title.closest(`.${styles.plate}`));
    expect(container.querySelectorAll('[data-edu-role="summary"]')).toHaveLength(1);
  });

  it('places the transparent brand inside the curriculum column, not after a loose build list', () => {
    const { container } = renderBootdev();
    const builds = container.querySelector('[data-course-group="builds"]')!;
    const coursework = container.querySelector('[data-course-group="coursework"]')!;
    const brand = screen.getByRole('img', { name: 'Boot.dev' });
    expect(builds.querySelector('[data-edu-brand]')).toBeNull();
    expect(coursework.contains(brand)).toBe(true);
    expect(coursework.firstElementChild).toHaveAttribute('data-edu-brand');
    expect(builds.querySelectorAll('li')).toHaveLength(4);
    expect(coursework.querySelectorAll('li')).toHaveLength(6);
    expect(brand).toHaveAttribute('src', '/images/education/bootdev-color.webp');
    expect(coursework.querySelector('[data-edu-brand-white]'))
      .toHaveAttribute('src', '/images/education/bootdev-white.webp');
    expect(container.querySelector('a, button, [tabindex]')).toBeNull();
  });

  it('preserves the complete content and heading when the record is inactive', () => {
    const { container } = render(
      <EducationRecord record={bootdev} position={2} onWheel={vi.fn()} inactive interactive={false} />
    );
    expect(container.querySelector('article')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('li')).toHaveLength(10);
    expect(screen.queryByRole('heading', { name: 'Bootdev' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Bootdev', hidden: true })).toBeInTheDocument();
  });

  it('uses a full-height curriculum column and gives the builds the remaining plate space', () => {
    expect(declarations(bootSelector, 'grid-template-areas'))
      .toEqual(["'plate curriculum' 'builds curriculum'"]);
    expect(declarations(`${bootSelector} [data-course-group='builds']`, 'grid-area')).toEqual(['builds']);
    expect(declarations(`${bootSelector} [data-course-group='coursework']`, 'grid-area')).toEqual(['curriculum']);
    expect(declarations(`${bootSelector} :is(.detail, .courseColumns)`, 'display')).toEqual(['contents']);
    expect(declarations(`${bootSelector} .items`, 'flex')).toEqual(['1 1 auto']);
    expect(declarations(`${bootSelector} .item`, 'flex')).toEqual(['1 1 0']);
  });

  it('keeps the existing palette and a transparent, shadow-free white mark on contrasting pine', () => {
    const curriculum = `${bootSelector} [data-course-group='coursework']`;
    expect(declarations(curriculum, 'background')).toEqual(['var(--ink)']);
    expect(declarations(`${curriculum} .itemText`, 'color')).toEqual(['var(--paper)']);
    expect(declarations(`${curriculum} .itemDate`, 'color'))
      .toEqual(['color-mix(in srgb, var(--paper) 78%, transparent)']);
    expect(declarations('.brandStamp', 'background')).toEqual(['transparent']);
    expect(declarations(`${bootSelector} .brandWhite`, 'filter')).toEqual(['none']);
  });

  it('retains readable compact type instead of shrinking everything to make a tall card fit', () => {
    expect(declarations(`${bootSelector} [data-course-group='builds'] .itemText`, 'font-size'))
      .toEqual(['clamp(1.125rem, 1.55vw, 1.625rem)', '1.125rem']);
    expect(declarations(`${bootSelector} [data-course-group='coursework'] .itemText`, 'font-size'))
      .toEqual(['clamp(0.9375rem, 1.12vw, 1.125rem)']);
    expect(declarations(`${bootSelector} .summary`, 'font-size'))
      .toEqual(['clamp(1rem, 1.1vw, 1.125rem)', '0.9375rem']);
    expect(declarations(`${bootSelector} .itemDate`, 'display')).toEqual(['block', 'inline']);
    expect(declarations(`${bootSelector} .item[data-build='true']::before`, 'content')).toEqual(['none']);
  });

  it('keeps build dates in a baseline-aligned column so the full ledger fits below the plate', () => {
    const builds = `${bootSelector} [data-course-group='builds']`;
    expect(declarations(`${builds} .itemText`, 'display')).toEqual(['grid']);
    expect(declarations(`${builds} .itemText`, 'grid-template-columns')).toEqual(['minmax(0, 1fr) max-content']);
    expect(declarations(`${builds} .itemText`, 'align-items')).toEqual(['baseline']);
    expect(declarations(`${builds} .itemDate`, 'margin')).toEqual(['0']);
    expect(declarations(`${builds} .itemDate`, 'white-space')).toEqual(['nowrap']);
    expect(declarations(`${bootSelector} [data-course-group='coursework'] .item`, 'padding-block'))
      .toEqual(['clamp(0.3rem, 0.55vh, 0.6rem)']);
  });
});
