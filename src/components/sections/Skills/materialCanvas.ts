import { getMaterialGeometry, type MaterialQuality } from './skillGeometry';
import type { SkillScene } from './skillsData';
import { writeAttribute } from '@/lib/dom/cachedElement';

type Point = readonly [number, number];

function interpolatePoints(from: readonly Point[], to: readonly Point[], t: number, output: Float64Array) {
  for (let index = 0; index < from.length; index++) {
    output[index * 2] = from[index][0] + (to[index][0] - from[index][0]) * t;
    output[index * 2 + 1] = from[index][1] + (to[index][1] - from[index][1]) * t;
  }
}

function interpolateContour(from: readonly number[], to: readonly number[], t: number, output: Float64Array) {
  for (let index = 0; index < from.length; index++) output[index] = from[index] + (to[index] - from[index]) * t;
}

function contour(context: CanvasRenderingContext2D, points: Float64Array) {
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 6) {
    context.bezierCurveTo(
      points[index], points[index + 1], points[index + 2],
      points[index + 3], points[index + 4], points[index + 5],
    );
  }
  context.closePath();
}

/** The same material geometry, batched into one 2D paint on low-tier hardware. */
export function createMaterialCanvas(
  canvas: HTMLCanvasElement,
  sculpture: Element,
  quality: MaterialQuality,
) {
  const context = canvas.getContext('2d');
  if (!context) {
    console.warn('Skills 2D material rendering is unavailable; retaining the SVG material.');
    return null;
  }
  const initial = getMaterialGeometry('languages', quality);
  const outer = new Float64Array(initial.outerContour.length);
  const inner = new Float64Array(initial.innerContour.length);
  const panelPoints = new Float64Array(initial.panelContour.length);
  const signalPoints = new Float64Array(8);
  let fromScene: SkillScene = 'languages';
  let toScene: SkillScene = 'languages';
  let progress = 1;
  let disposed = false;
  let face: CanvasGradient;
  let edge = '';
  let side = '';
  let deep = '';
  let inset = '';
  let accent = '';

  const palette = () => {
    const styles = getComputedStyle(sculpture);
    const color = (name: string) => styles.getPropertyValue(`--skill-${name}`).trim();
    face = context.createLinearGradient(220, 100, 496, 437);
    face.addColorStop(0, color('face'));
    face.addColorStop(0.55, color('face-low'));
    face.addColorStop(1, color('shade'));
    edge = color('edge');
    side = color('side');
    deep = color('dark-side');
    inset = color('inset');
    accent = color('accent');
  };
  const ring = (x: number, y: number, fill: string | CanvasGradient) => {
    context.save();
    context.translate(x, y);
    context.beginPath();
    contour(context, outer);
    contour(context, inner);
    context.fillStyle = fill;
    context.fill('evenodd');
    context.strokeStyle = edge;
    context.lineWidth = 1.35;
    context.stroke();
    context.restore();
  };
  const paint = () => {
    if (disposed) return;
    const from = getMaterialGeometry(fromScene, quality);
    const to = getMaterialGeometry(toScene, quality);
    interpolateContour(from.outerContour, to.outerContour, progress, outer);
    interpolateContour(from.innerContour, to.innerContour, progress, inner);
    interpolateContour(from.panelContour, to.panelContour, progress, panelPoints);
    const depth = from.depth + (to.depth - from.depth) * progress;
    const surfaceOpacity = from.surfaceOpacity + (to.surfaceOpacity - from.surfaceOpacity) * progress;
    context.clearRect(0, 0, 720, 580);
    context.globalAlpha = surfaceOpacity;
    context.lineJoin = 'round';
    if (surfaceOpacity > 0) {
      ring(8, depth, deep);
      ring(4, depth / 2, side);
      ring(0, 0, face);
      context.beginPath();
      contour(context, panelPoints);
      context.globalAlpha = surfaceOpacity * (from.panelOpacity + (to.panelOpacity - from.panelOpacity) * progress);
      context.fillStyle = inset;
      context.fill();
    }
    context.globalAlpha = 1;
    context.strokeStyle = accent;
    context.lineWidth = 3.1;
    context.lineCap = 'round';
    for (let index = 0; index < from.signals.length; index++) {
      const a = from.signals[index];
      const b = to.signals[index];
      context.globalAlpha = a.opacity + (b.opacity - a.opacity) * progress;
      if (context.globalAlpha === 0) continue;
      interpolatePoints(a.points, b.points, progress, signalPoints);
      context.beginPath();
      context.moveTo(signalPoints[0], signalPoints[1]);
      context.bezierCurveTo(
        signalPoints[2], signalPoints[3], signalPoints[4],
        signalPoints[5], signalPoints[6], signalPoints[7],
      );
      context.stroke();
    }
    context.globalAlpha = 1;
  };
  palette();
  paint();
  writeAttribute(sculpture, 'data-material-renderer', 'canvas2d');
  const observer = new MutationObserver(() => { palette(); paint(); });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return {
    transition(from: SkillScene, to: SkillScene) {
      let value = 0;
      return {
        get progress() { return value; },
        set progress(next: number) {
          value = next;
          fromScene = from;
          toScene = to;
          progress = next;
          paint();
        },
      };
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      writeAttribute(sculpture, 'data-material-renderer', null);
    },
  };
}
