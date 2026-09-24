import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Everything under public/ is copied into dist/ and deployed unchanged. */
const PUBLIC = resolve('public');
const DEPLOYED_ASSET_BUDGET_BYTES = 60 * 1024 * 1024;

interface Entry { path: string; bytes: number; directory: boolean }

function walk(directory: string): Entry[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? [{ path, bytes: 0, directory: true }, ...walk(path)]
      : [{ path, bytes: statSync(path).size, directory: false }];
  });
}

describe('deployed static assets', () => {
  const entries = walk(PUBLIC);

  it('ship no archival source originals', () => {
    // Originals live in assets/originals, which Vite does not publish.
    expect(entries.filter(entry => entry.directory && /[\\/]original$/.test(entry.path))).toEqual([]);
  });

  it('stay within the deployed asset budget', () => {
    const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    expect(total).toBeLessThanOrEqual(DEPLOYED_ASSET_BUDGET_BYTES);
  });
});
