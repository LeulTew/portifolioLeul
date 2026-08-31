import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';
import {
  CAMERA_ARC_END,
  createCameraSpline,
  mapScrollToArc,
  nearestChapterIndex,
  sampleCameraPose,
  sampleChapterPose,
} from '@/lib/camera/cinematicSpline';
import { getCameraHold } from '@/lib/camera/cameraHold';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { isFrameDrawn } from '@/lib/render/frameGate';

/**
 * Scrubs the camera along the cinematic spline as the page scrolls, and parks
 * it on the final shot once the arc completes so the DOM layer can keep
 * scrolling underneath. Scene objects are never touched.
 */

// Module-scope scratch. Allocating inside useFrame would churn the GC at 60fps.
const desiredPosition = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();
const smoothedTarget = new THREE.Vector3();

/** Higher converges faster. Tuned so a flick of the wheel still reads as a move. */
const POSITION_DAMPING = 3.2;
const TARGET_DAMPING = 4;

/** World units the viewpoint drifts at the edges of the pointer range. */
const DEFAULT_MOUSE_SWAY = 1.6;

/** A backgrounded tab hands back a huge delta; clamp so the camera never snaps. */
const MAX_FRAME_DELTA = 0.1;

export interface CinematicCameraControllerProps {
  /** Scroll progress at which the camera arc completes and holds. */
  arcEnd?: number;
  /** World units of pointer parallax. Zero disables pointer response. */
  mouseSway?: number;
}

export function CinematicCameraController({
  arcEnd = CAMERA_ARC_END,
  mouseSway = DEFAULT_MOUSE_SWAY,
}: CinematicCameraControllerProps = {}) {
  const camera = useThree((state) => state.camera);
  const scroll = useScroll();
  const spline = useMemo(() => createCameraSpline(), []);
  const hasSettled = useRef(false);

  useFrame((state, delta) => {
    if (!camera) return;
    // Same reasoning as the grade: the damping is exact over an accumulated
    // delta, so posing the camera for an undrawn frame buys nothing.
    if (!isFrameDrawn(state.clock.getElapsedTime())) return;

    const reducedMotion = getPrefersReducedMotion();
    const arc = mapScrollToArc(scroll?.offset ?? 0, arcEnd, getCameraHold());

    if (reducedMotion) {
      // Discrete cuts between authored shots: no scrubbing, no pointer drift.
      sampleChapterPose(nearestChapterIndex(arc), desiredPosition, desiredTarget);
      camera.position.copy(desiredPosition);
      smoothedTarget.copy(desiredTarget);
      camera.lookAt(smoothedTarget);
      hasSettled.current = true;
      return;
    }

    sampleCameraPose(spline, arc, desiredPosition, desiredTarget);

    const pointerX = state.mouse?.x ?? 0;
    const pointerY = state.mouse?.y ?? 0;
    desiredPosition.x += pointerX * mouseSway;
    desiredPosition.y += pointerY * mouseSway * 0.5;

    if (!hasSettled.current) {
      // First frame: take the shot as authored rather than easing in from the
      // default camera position, which would read as an unintended fly-in.
      camera.position.copy(desiredPosition);
      smoothedTarget.copy(desiredTarget);
      hasSettled.current = true;
    } else {
      const step = Math.min(delta ?? 0, MAX_FRAME_DELTA);
      const { damp } = THREE.MathUtils;

      camera.position.x = damp(camera.position.x, desiredPosition.x, POSITION_DAMPING, step);
      camera.position.y = damp(camera.position.y, desiredPosition.y, POSITION_DAMPING, step);
      camera.position.z = damp(camera.position.z, desiredPosition.z, POSITION_DAMPING, step);

      smoothedTarget.x = damp(smoothedTarget.x, desiredTarget.x, TARGET_DAMPING, step);
      smoothedTarget.y = damp(smoothedTarget.y, desiredTarget.y, TARGET_DAMPING, step);
      smoothedTarget.z = damp(smoothedTarget.z, desiredTarget.z, TARGET_DAMPING, step);
    }

    camera.lookAt(smoothedTarget);
  });

  return null;
}
