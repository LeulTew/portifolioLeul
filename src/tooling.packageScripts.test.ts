import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Round 32 (TECH-086): `native:scroll` ran a script that existed in the
 * author's checkout but that `.gitignore` kept out of every commit, so the
 * tool the docs and rules require could not run anywhere else.
 */
const scripts = (JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
const files = Object.entries(scripts).flatMap(([name, command]) =>
  [...command.matchAll(/(?:^|\s)((?:scripts|src)\/[\w./-]+\.(?:ts|mts|mjs|js|json))\b/g)].map(match => [name, match[1]] as const));

/** Whether git would leave the path out of a commit: `check-ignore` exits 0 for ignored, 1 for not. */
function ignored(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--quiet', path], { stdio: 'ignore' });
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 1) return false;
    throw error;
  }
}

describe('package scripts', () => {
  it('run files of this repository', () => {
    expect(files.map(([name]) => name)).toEqual(expect.arrayContaining(['perf:budget', 'native:scroll', 'bake:island']));
  });

  it.each(files)('%s runs %s, which exists and is committed with the repository', (_name, file) => {
    expect(existsSync(resolve(file)), file).toBe(true);
    expect(ignored(file), `${file} is git-ignored`).toBe(false);
  });
});
