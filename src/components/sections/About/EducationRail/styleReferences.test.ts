import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';

describe('education artwork styling', () => {
  it('uses transparent Boot.dev artwork with hover-only color and a hover-only clear school disc', () => {
    const css = postcss.parse(readFileSync(join(__dirname, 'EducationRail.module.css'), 'utf8'));
    const values = (selector: string, property: string) => {
      const found: string[] = [];
      css.walkRules(selector, rule => {
        rule.walkDecls(property, declaration => { found.push(declaration.value); });
      });
      return found;
    };
    expect(values('.brandStamp', 'background')).toEqual(['transparent']);
    expect(values('.brandStamp', 'pointer-events')).toEqual(['auto']);
    expect(values('.brandWhite', 'opacity')).toEqual(['1']);
    expect(values('.brandColor', 'opacity')).toEqual(['0']);
    expect(values('.brandStamp:hover .brandWhite', 'opacity')).toEqual(['0']);
    expect(values('.brandStamp:hover .brandColor', 'opacity')).toEqual(['1']);
    expect(values('.sealDisc', 'background')).toEqual(['#164b36']);
    expect(values('.sealDisc:hover', 'background')).toEqual(['transparent']);
    expect(values('.sealDisc:hover', 'box-shadow')).toEqual(['none']);
  });

  it('resolves every referenced module class to a real stylesheet selector', () => {
    const classes = new Set<string>();
    postcss.parse(readFileSync(join(__dirname, 'EducationRail.module.css'), 'utf8'))
      .walkRules((rule) => {
        for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
          classes.add(match[1]);
        }
      });
    const missing: string[] = [];
    for (const file of [
      'EducationRail.tsx', 'EducationRecord.tsx', 'EducationArtwork.tsx',
      'EducationText.tsx', 'EducationBrand.tsx',
      'educationMotion.ts', 'educationReveal.ts',
      'SaintJosephMark.tsx', 'HilcoeMark.tsx',
    ]) {
      const source = readFileSync(join(__dirname, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const match of source.matchAll(/styles\.(\w+)/g)) {
        if (!classes.has(match[1])) missing.push(`${file}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('never adds an internal scroll region or an autonomous CSS animation', () => {
    const forbidden: string[] = [];
    postcss.parse(readFileSync(join(__dirname, 'EducationRail.module.css'), 'utf8'))
      .walkDecls((declaration) => {
        if (
          (/^overflow(?:-[xy])?$/.test(declaration.prop) && /auto|scroll/.test(declaration.value)) ||
          /^animation(?:-|$)/.test(declaration.prop)
        ) {
          forbidden.push(`${declaration.prop}: ${declaration.value}`);
        }
      });
    expect(forbidden).toEqual([]);
  });

  it('promotes glyphs only during motion on the visible, active record', () => {
    const promoted: string[] = [];
    postcss.parse(readFileSync(join(__dirname, 'EducationRail.module.css'), 'utf8'))
      .walkRules((rule) => {
        if (!/data-edu-glyph|\.glyph\b/.test(rule.selector)) return;
        rule.walkDecls('will-change', () => { promoted.push(rule.selector); });
      });
    expect(promoted).toHaveLength(1);
    expect(promoted[0]).toContain("[data-visible='true']");
    expect(promoted[0]).toContain("[data-reveal='true']");
    expect(promoted[0]).toContain("[data-record]:not([aria-hidden='true'])");
    expect(promoted[0]).toContain("[data-phase='opening']");
    expect(promoted[0]).toContain("[data-phase='crossing']");
    expect(promoted[0]).toContain("[data-phase='closing']");
    expect(promoted[0]).not.toContain("[data-phase='reading']");
  });

  it('keeps the fixed footer clearance on compact desktop layouts', () => {
    const padding: string[] = [];
    postcss.parse(readFileSync(join(__dirname, 'EducationRail.module.css'), 'utf8'))
      .walkRules('.pinned', (rule) => {
        rule.walkDecls('padding-bottom', declaration => { padding.push(declaration.value); });
      });
    expect(padding).toEqual(['calc(max(2rem, 3vw) + 2.5rem)']);
  });
});
