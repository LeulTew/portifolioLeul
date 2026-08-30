import { useMemo, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA_ARC_SETTLE, mapScrollToArc } from '@/lib/camera/cinematicSpline';
import {
  DARK_GRADES,
  LIGHT_GRADES,
  createGradeTarget,
  sampleGrade,
} from '@/lib/atmosphere/chapterGrade';
import { getCameraHold } from '@/lib/camera/cameraHold';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';

/**
 * Cross-fades lighting and fog depth along the camera arc.
 *
 * Mutates the existing fog and lights in place rather than re-rendering them,
 * so a scroll never triggers React work in the 3D tree.
 */

// Module-scope scratch, reused every frame.
const target = createGradeTarget();

/** Higher converges faster. Slower than the camera, so the grade trails it. */
const GRADE_DAMPING = 2.4;

/** A backgrounded tab hands back a huge delta; clamp so the grade never snaps. */
const MAX_FRAME_DELTA = 0.1;

export interface ChapterGradingProps {
  isLight: boolean;
  ambientRef: RefObject<THREE.AmbientLight>;
  keyLightRef: RefObject<THREE.DirectionalLight>;
  settle?: number;
}

export function ChapterGrading({
  isLight,
  ambientRef,
  keyLightRef,
  settle = CAMERA_ARC_SETTLE,
}: ChapterGradingProps) {
  const scene = useThree((state) => state.scene);
  const scroll = useScroll();
  const grades = useMemo(() => (isLight ? LIGHT_GRADES : DARK_GRADES), [isLight]);

  useFrame((_state, delta) => {
    sampleGrade(grades, mapScrollToArc(scroll?.offset ?? 0, settle, getCameraHold()), target);

    // Reduced motion still gets the grade, just without the easing: the point
    // is the depth and colour of the shot, not the transition.
    const step = getPrefersReducedMotion()
      ? 1
      : 1 - Math.exp(-GRADE_DAMPING * Math.min(delta ?? 0, MAX_FRAME_DELTA));

    const ambient = ambientRef.current;
    if (ambient) {
      ambient.intensity += (target.ambient - ambient.intensity) * step;
    }

    const key = keyLightRef.current;
    if (key) {
      key.intensity += (target.directional - key.intensity) * step;
      key.color.lerp(target.keyColor, step);
    }

    const fog = scene?.fog;
    if (fog instanceof THREE.Fog) {
      fog.near += (target.fogNear - fog.near) * step;
      fog.far += (target.fogFar - fog.far) * step;
      fog.color.lerp(target.fogColor, step);
    }
  });

  return null;
}
