import artwork from '@/data/avatar-echo.json';
import { easeInOutCubic } from '@/lib/motion/triggeredPhase';

export const ECHO_DURATION_MS = artwork.duration * 1000;
export const ECHO_RETURN_MS = 720;
export const ECHO_POINT_VALUES = artwork.frames[0].length;
export const ECHO_BOUNDS: readonly number[] = artwork.bounds;
export const ECHO_DETAIL_LAYERS = artwork.detailLayers;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function sampleAvatarContour(time: number, target: Float32Array): void {
  if (!Number.isFinite(time) || target.length !== ECHO_POINT_VALUES) {
    throw new RangeError('A contour needs finite time and its complete point buffer.');
  }
  const position = ((time % artwork.duration + artwork.duration) % artwork.duration) /
    artwork.duration * artwork.frames.length;
  const first = Math.floor(position);
  const a = artwork.frames[first];
  const b = artwork.frames[(first + 1) % artwork.frames.length];
  const mix = position - first;
  for (let i = 0; i < target.length; i++) target[i] = a[i] + (b[i] - a[i]) * mix;
}

function closedPath(points: Float32Array, offset: number, count: number): string {
  let path = '';
  for (let i = offset; i < offset + count * 2; i += 2) {
    path += `${i === offset ? 'M' : 'L'}${points[i].toFixed(1)} ${points[i + 1].toFixed(1)}`;
  }
  return `${path}Z`;
}

export function avatarContourPath(points: Float32Array): string {
  return closedPath(points, 0, artwork.outlinePoints);
}

export function avatarDetailPaths(points: Float32Array): string[] {
  let offset = artwork.outlinePoints * 2;
  return artwork.detailLayers.map(layer => layer.counts.map(count => {
    const path = closedPath(points, offset, count);
    offset += count * 2;
    return path;
  }).join(''));
}

export interface EchoComposition {
  center: number;
  foot: number;
  x: number;
  y: number;
  scale: number;
}

export function echoComposition(width: number, height: number): EchoComposition {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width + height)) {
    throw new RangeError('An avatar encounter needs a finite visible viewport.');
  }
  const [left, top, right, bottom] = artwork.bounds;
  const center = (left + right) / 2;
  const targetHeight = Math.min(height * 0.57, 960);
  const scale = targetHeight / ((bottom - top) * height / 1000);
  const frameWidth = Math.min(1280, width - 96);
  const originalLeft = width / 2 + (left - 500) * height / 1000;
  const halfDrawing = (right - left) * height / 1000 * scale / 2;
  const portraitX = Math.min(width / 2 + frameWidth * 0.25, originalLeft - 24 - halfDrawing);
  return {
    center,
    foot: bottom,
    x: 500 + (portraitX - width / 2) / height * 1000 - center,
    y: 790 - bottom,
    scale,
  };
}

export function echoTransform(composition: EchoComposition, progress: number): string {
  const t = clamp(progress);
  const { center, foot, x, y, scale } = composition;
  return `translate(${(x * t).toFixed(3)} ${(y * t).toFixed(3)}) ` +
    `translate(${center} ${foot}) scale(${(1 + (scale - 1) * t).toFixed(5)}) translate(${-center} ${-foot})`;
}

export function echoArrival(elapsed: number): number {
  return easeInOutCubic(clamp(elapsed / 1250));
}

export function echoCopyReveal(elapsed: number): number {
  return easeInOutCubic(clamp((elapsed - 300) / 650));
}
