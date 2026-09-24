import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve('index.html'), 'utf8');
const asset = (path: string) => readFileSync(resolve('public', path.replace(/^\//, '')));

function pngSize(bytes: Buffer): [number, number] {
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

/** Width and height from the first start-of-frame marker of a baseline or progressive JPEG. */
function jpegSize(bytes: Buffer): [number, number] {
  expect(bytes.readUInt16BE(0)).toBe(0xffd8);
  for (let offset = 2; offset < bytes.length;) {
    const marker = bytes.readUInt16BE(offset);
    if (marker === 0xffc0 || marker === 0xffc2) return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error('No JPEG frame header');
}

describe('brand marks and share card', () => {
  it('uses the LT monogram at tab size instead of a shrunken portrait', () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(asset('/favicon.svg').toString()).toMatch(/^<svg[^>]+viewBox="0 0 64 64"/);
    expect(html).toContain('href="/favicon-32.png"');
    expect(pngSize(asset('/favicon-32.png'))).toEqual([32, 32]);
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(pngSize(asset('/apple-touch-icon.png'))).toEqual([180, 180]);
  });

  it('shares a genuine 1200x630 capture with matching declared dimensions and alt text', () => {
    for (const property of ['og:image', 'twitter:image']) {
      expect(html).toContain(`<meta property="${property}" content="https://leul-t-agonafer.vercel.app/images/og-card.jpg" />`);
      expect(html).toMatch(new RegExp(`property="${property}:alt" content="[^"]{20,}"`));
    }
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(jpegSize(asset('/images/og-card.jpg'))).toEqual([1200, 630]);
    expect(statSync(resolve('public', 'images', 'og-card.jpg')).size).toBeLessThan(300 * 1024);
  });
});
