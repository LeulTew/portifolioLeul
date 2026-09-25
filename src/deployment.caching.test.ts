import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Rule { source: string }
interface HeaderRule extends Rule { headers: { key: string; value: string }[] }

const deployment = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  headers: HeaderRule[];
  rewrites: (Rule & { destination: string })[];
};

/** A vercel.json source as the anchored pattern it matches with. */
const pattern = (source: string) => new RegExp(`^${source}$`);

describe('deployment caching', () => {
  it('lets the browser keep content-hashed bundles without asking again', () => {
    // Every return visit revalidated each bundle: max-age=0 is Vercel's default for static files.
    const rule = deployment.headers.find(({ source }) => source === '/assets/(.*)');
    expect(rule?.headers).toEqual([{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
  });

  it.runIf(existsSync('dist/assets'))('puts only content-hashed files where they are cached for good', () => {
    for (const file of readdirSync('dist/assets')) expect(file).toMatch(/-[\w-]{8}\.[a-z0-9]+$/);
  });

  it('answers a missing bundle with a 404, not with the page cached as the bundle', () => {
    const [fallback] = deployment.rewrites;
    expect(fallback.destination).toBe('/index.html');
    const matches = (path: string) => pattern(fallback.source).test(path);
    expect(matches('/')).toBe(true);
    expect(matches('/projects/deep-link')).toBe(true);
    expect(matches('/assets/main-DZFp_2s7.js')).toBe(false);
  });
});
