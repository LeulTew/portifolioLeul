import * as THREE from 'three';

/**
 * Camera choreography for the scroll-driven 3D chapters.
 *
 * The scene's object placements are authored fixed; nothing here moves them.
 * Only the viewpoint travels, along a Catmull-Rom spline sampled from the
 * page's normalized scroll progress.
 */

export interface CameraChapter {
  /** Section anchor this shot belongs to, for debugging and readouts. */
  readonly id: string;
  /** Where the camera sits. */
  readonly position: readonly [number, number, number];
  /** What the camera frames. */
  readonly target: readonly [number, number, number];
}

/**
 * Scroll progress at which the camera arc completes. Past this point the
 * viewpoint holds its final shot while the DOM layer keeps scrolling, so the
 * page never feels like it has hit a wall when the 3D travel runs out.
 */
export const CAMERA_ARC_END = 0.62;

/**
 * The closing shot, reproduced from the composition this scene had before the
 * camera was put on a spline.
 *
 * Back then the camera sat at [0, 5, 30] looking at the origin while the whole
 * scene rotated by `scrollProgress * PI`, so the arc ended with the world spun
 * a half turn. A world rotated 180 degrees about Y under a fixed camera is the
 * same view as a fixed world with the camera at R(-180) * [0, 5, 30], still
 * looking at the origin -- which is [0, 5, -30], the shot that brings the
 * television around to face the viewer.
 */
export const CLOSING_SHOT: CameraChapter = {
  id: 'contact',
  position: [0, 5, -30],
  target: [0, 0, 0],
};

/**
 * One shot per scrolled section.
 *
 * The path is the same half-turn orbit the scene always had -- radius ~30
 * around the island, swinging out to the left -- rather than an arbitrary set
 * of viewpoints, so the travel reads as one continuous move and never cuts
 * through the terrain.
 */
export const CAMERA_CHAPTERS: readonly CameraChapter[] = [
  // Hero: high establishing shot over the whole island.
  { id: 'home', position: [0, 12, 34], target: [0, 0, -14] },
  // About: swinging out to the left, framing the CRT.
  { id: 'about', position: [-24, 8, 22], target: [-10, 0.5, -14] },
  // Skills: side-on at the midpoint of the orbit.
  { id: 'skills', position: [-32, 7, 2], target: [0, -1, -16] },
  // Projects: round the back, looking across at the prism and the avatar.
  { id: 'projects', position: [-23, 6, -22], target: [6, 0, -16] },
  // Contact: the original closing composition.
  CLOSING_SHOT,
] as const;

export interface CameraSpline {
  readonly positionCurve: THREE.CatmullRomCurve3;
  readonly targetCurve: THREE.CatmullRomCurve3;
}

export function createCameraSpline(
  chapters: readonly CameraChapter[] = CAMERA_CHAPTERS
): CameraSpline {
  if (chapters.length < 2) {
    throw new Error('A camera spline needs at least two chapters.');
  }

  const toPoints = (pick: (c: CameraChapter) => readonly [number, number, number]) =>
    chapters.map((chapter) => new THREE.Vector3(...pick(chapter)));

  return {
    positionCurve: new THREE.CatmullRomCurve3(
      toPoints((c) => c.position),
      false,
      'catmullrom',
      0.5
    ),
    targetCurve: new THREE.CatmullRomCurve3(
      toPoints((c) => c.target),
      false,
      'catmullrom',
      0.5
    ),
  };
}

/**
 * Rescales page scroll onto the camera arc and clamps it. Scroll past
 * `arcEnd` returns 1, which parks the camera on its final shot.
 */
export function mapScrollToArc(scrollProgress: number, arcEnd: number = CAMERA_ARC_END): number {
  if (!Number.isFinite(scrollProgress) || scrollProgress <= 0) return 0;
  if (arcEnd <= 0) return 1;
  const arc = scrollProgress / arcEnd;
  return arc >= 1 ? 1 : arc;
}

/** Nearest authored shot, used to jump discretely under reduced motion. */
export function nearestChapterIndex(
  arcProgress: number,
  chapterCount: number = CAMERA_CHAPTERS.length
): number {
  const lastIndex = Math.max(chapterCount - 1, 0);
  if (!Number.isFinite(arcProgress) || arcProgress <= 0) return 0;
  if (arcProgress >= 1) return lastIndex;
  return Math.round(arcProgress * lastIndex);
}

/**
 * Writes the pose at `arcProgress` into the caller's vectors. Takes output
 * parameters so the render loop can reuse scratch objects and allocate nothing.
 */
export function sampleCameraPose(
  spline: CameraSpline,
  arcProgress: number,
  outPosition: THREE.Vector3,
  outTarget: THREE.Vector3
): void {
  const t = Number.isFinite(arcProgress) ? Math.min(1, Math.max(0, arcProgress)) : 0;
  spline.positionCurve.getPoint(t, outPosition);
  spline.targetCurve.getPoint(t, outTarget);
}

/** Writes the exact authored pose for a chapter, bypassing the spline. */
export function sampleChapterPose(
  index: number,
  outPosition: THREE.Vector3,
  outTarget: THREE.Vector3,
  chapters: readonly CameraChapter[] = CAMERA_CHAPTERS
): void {
  const clamped = Math.min(Math.max(index, 0), chapters.length - 1);
  const chapter = chapters[clamped];
  outPosition.set(...chapter.position);
  outTarget.set(...chapter.target);
}
