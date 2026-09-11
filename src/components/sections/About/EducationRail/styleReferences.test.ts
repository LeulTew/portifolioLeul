import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';

describe('education artwork styling', () => {
  it('resolves every referenced module class to a real stylesheet selector', () => {
    const classes = new Set<string>();
    postcss.parse(readFileSync(join(__dirname, 'EducationRail.module.css'), 'utf8'))
      .walkRules((rule) => {
        for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
          classes.add(match[1]);
        }
      });
    const missing: string[] = [];
    for (const file of ['EducationRail.tsx', 'SaintJosephMark.tsx', 'HilcoeMark.tsx']) {
      const source = readFileSync(join(__dirname, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const match of source.matchAll(/styles\.(\w+)/g)) {
        if (!classes.has(match[1])) missing.push(`${file}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
