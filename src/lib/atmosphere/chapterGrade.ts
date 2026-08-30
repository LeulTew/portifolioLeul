import * as THREE from 'three';
import { CAMERA_CHAPTERS } from '@/lib/camera/cinematicSpline';

/**
 * Per-chapter lighting and depth grading, cross-faded along the same arc
 * progress that drives the camera.
 *
 * Deliberately restrained. The focus scrims occlude the world wherever there
 * is copy to read, so the grade only reads during the hero, the transitions
 * and the breath before contact. Large swings there would draw attention to
 * the mechanism rather than the world.
 */

export interface ChapterGrade {
  readonly ambient: number;
  readonly directional: number;
  /** Where fog starts, in world units from the camera. */
  readonly fogNear: number;
  /** Where fog becomes opaque. Lower values close the world in. */
  readonly fogFar: number;
  readonly fogColor: THREE.Color;
  readonly keyColor: THREE.Color;
}

/** Mutable target the render loop writes into, so it allocates nothing. */
export interface GradeTarget {
  ambient: number;
  directional: number;
  fogNear: number;
  fogFar: number;
  readonly fogColor: THREE.Color;
  readonly keyColor: THREE.Color;
}

export function createGradeTarget(): GradeTarget {
  return {
    ambient: 0,
    directional: 0,
    fogNear: 0,
    fogFar: 0,
    fogColor: new THREE.Color(),
    keyColor: new THREE.Color(),
  };
}

const grade = (
  ambient: number,
  directional: number,
  fogNear: number,
  fogFar: number,
  fogColor: string,
  keyColor: string
): ChapterGrade => ({
  ambient,
  directional,
  fogNear,
  fogFar,
  fogColor: new THREE.Color(fogColor),
  keyColor: new THREE.Color(keyColor),
});

/** One grade per camera chapter, in the same order. */
export const DARK_GRADES: readonly ChapterGrade[] = [
  // Hero: open and cold, the whole island legible to the horizon.
  grade(0.2, 0.5, 34, 78, '#001a1a', '#ffffff'),
  // About: closer and warmer, lit as if by the CRT.
  grade(0.28, 0.62, 22, 58, '#04211f', '#ffe9c9'),
  // Skills: pulled back, air thinning out again.
  grade(0.22, 0.55, 30, 70, '#021d1f', '#e8f6ff'),
  // Projects: the prism lifts the key toward neon.
  grade(0.26, 0.6, 26, 64, '#03201c', '#c9ffe8'),
  // Contact: deep horizon, the world receding.
  grade(0.18, 0.45, 38, 92, '#001416', '#bcd6ff'),
] as const;

export const LIGHT_GRADES: readonly ChapterGrade[] = [
  grade(0.6, 1.1, 34, 78, '#f6f8ff', '#ffffff'),
  grade(0.68, 1.2, 22, 58, '#fbf6ee', '#fff1d8'),
  grade(0.62, 1.14, 30, 70, '#f4f8ff', '#f2fbff'),
  grade(0.66, 1.18, 26, 64, '#f2fbf6', '#e6fff4'),
  grade(0.56, 1, 38, 92, '#eef3fc', '#e4ecff'),
] as const;

/**
 * Resolves arc progress onto a pair of adjacent chapters and the blend between
 * them. Split out from sampling so the mapping can be asserted on its own.
 */
export function resolveGradeSpan(
  arcProgress: number,
  chapterCount: number = CAMERA_CHAPTERS.length
): { from: number; to: number; mix: number } {
  const lastIndex = Math.max(chapterCount - 1, 0);
  if (lastIndex === 0) return { from: 0, to: 0, mix: 0 };

  const clamped = Number.isFinite(arcProgress)
    ? Math.min(1, Math.max(0, arcProgress))
    : 0;

  const scaled = clamped * lastIndex;
  const from = Math.min(Math.floor(scaled), lastIndex - 1);

  return { from, to: from + 1, mix: scaled - from };
}

/** Writes the grade at `arcProgress` into `out`, allocating nothing. */
export function sampleGrade(
  grades: readonly ChapterGrade[],
  arcProgress: number,
  out: GradeTarget
): void {
  if (grades.length === 0) return;
  if (grades.length === 1) {
    copyGrade(grades[0], out);
    return;
  }

  const { from, to, mix } = resolveGradeSpan(arcProgress, grades.length);
  const a = grades[from];
  const b = grades[to];

  out.ambient = THREE.MathUtils.lerp(a.ambient, b.ambient, mix);
  out.directional = THREE.MathUtils.lerp(a.directional, b.directional, mix);
  out.fogNear = THREE.MathUtils.lerp(a.fogNear, b.fogNear, mix);
  out.fogFar = THREE.MathUtils.lerp(a.fogFar, b.fogFar, mix);
  out.fogColor.lerpColors(a.fogColor, b.fogColor, mix);
  out.keyColor.lerpColors(a.keyColor, b.keyColor, mix);
}

function copyGrade(source: ChapterGrade, out: GradeTarget): void {
  out.ambient = source.ambient;
  out.directional = source.directional;
  out.fogNear = source.fogNear;
  out.fogFar = source.fogFar;
  out.fogColor.copy(source.fogColor);
  out.keyColor.copy(source.keyColor);
}
