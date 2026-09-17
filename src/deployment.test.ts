import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESKTOP_ORIGIN } from './lib/deviceRouting';

describe('the deployed portfolio contract', () => {
  it('uses the frozen Bun lockfile and Vite output rather than auto-selecting a stale pnpm lock', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(config).toMatchObject({
      framework: 'vite',
      installCommand: 'bun install --frozen-lockfile',
      buildCommand: 'bun run build',
      outputDirectory: 'dist',
    });
    expect(config.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('routes before importing the desktop app and consistently publishes the canonical alias', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('src="/src/bootstrap.ts"');
    expect(html).not.toContain('src="/src/main.tsx"');
    expect(html).toContain(`rel="canonical" href="${DESKTOP_ORIGIN}/"`);
    expect(html).not.toContain('https://portifolio-leul.vercel.app');
    expect(readFileSync('public/sitemap.xml', 'utf8')).toContain(`<loc>${DESKTOP_ORIGIN}/</loc>`);
    expect(readFileSync('public/robots.txt', 'utf8')).toContain(`Sitemap: ${DESKTOP_ORIGIN}/sitemap.xml`);
  });
});
