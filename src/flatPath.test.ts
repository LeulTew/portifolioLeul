import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const GRAPHICS = /^(three|@react-three\/fiber|@react-three\/drei)(\/|$)/;

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? resolve(root, 'src', specifier.slice(2))
    : specifier.startsWith('.') ? resolve(dirname(from), specifier) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Every module the page loads before any dynamic import, and the graphics packages each names. */
function staticGraph(entry: string) {
  const graphics = new Map<string, string[]>();
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const [, specifier] of source.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;'"]*?from\s+['"]([^'"]+)['"]/gm)) {
      if (GRAPHICS.test(specifier)) graphics.set(relative(root, file), [...(graphics.get(relative(root, file)) ?? []), specifier]);
      const local = resolveLocal(file, specifier);
      if (local) visit(local);
    }
  };
  visit(entry);
  return { graphics, modules: seen.size };
}

describe('the page before the spatial stage', () => {
  it('reaches no graphics library until the stage is loaded', () => {
    // Round 10 (TECH-029): the no-WebGL page downloaded three and R3F it could never draw.
    const { graphics, modules } = staticGraph(resolve(root, 'src/main.tsx'));
    expect(modules).toBeGreaterThan(100);
    expect(Object.fromEntries(graphics)).toEqual({});
  });

  it('loads the stage only through its dynamic module', () => {
    const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
    expect(app).toMatch(/lazy\(loadSpatialStage\)/);
    expect(readFileSync(resolve(root, 'src/components/3d/spatialStageModule.ts'), 'utf8'))
      .toMatch(/import\('\.\/SpatialStage'\)/);
  });
});
