import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures', 'hero-cloud');
const layers = ['body', 'vapor', 'shear', 'mask'];

/**
 * Call bakeHeroCloud(page) with a Playwright Page from a Node.js runner.
 * SVG files are the editable sources; the browser supplies the original SVG
 * filter renderer, with no native image-processing dependency.
 */
export async function bakeHeroCloud(page) {
  const context = await page.context().browser().newContext();
  const renderer = await context.newPage();
  const results = [];
  try {
    for (const layer of layers) {
      const source = await readFile(join(directory, `${layer}.svg`), 'utf8');
      const image = await renderer.evaluate(async svg => {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('Cloud SVG could not be decoded'));
          image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        });
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const drawing = canvas.getContext('2d');
        if (!drawing) throw new Error('Cloud texture generation requires Canvas 2D');
        drawing.drawImage(image, 0, 0);
        const data = canvas.toDataURL('image/webp', 1);
        if (!data.startsWith('data:image/webp;base64,')) throw new Error('WebP encoding is unavailable');
        return { data: data.split(',')[1], width: canvas.width, height: canvas.height };
      }, source);
      const bytes = Buffer.from(image.data, 'base64');
      await writeFile(join(directory, `${layer}.webp`), bytes);
      results.push({ layer, width: image.width, height: image.height, bytes: bytes.length });
    }
  } finally {
    await context.close();
  }
  return results;
}
