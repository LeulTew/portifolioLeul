import { useMemo, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA_ARC_END, mapScrollToArc } from '@/lib/camera/cinematicSpline';
import {
  DARK_GRADES,
  LIGHT_GRADES,
  createGradeTarget,
  sampleGrade,
  type GradeTarget,
} from '@/lib/atmosphere/chapterGrade';
import { getCameraFreezes } from '@/lib/camera/cameraHold';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { drawnFrameDelta, isFrameDrawn } from '@/lib/render/frameGate';
import { getContactView, type ContactMode } from '@/lib/contact/contactScene';
import { easeInOutCubic } from '@/lib/motion/triggeredPhase';

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
  arcEnd?: number;
}

export function ChapterGrading({
  isLight,
  ambientRef,
  keyLightRef,
  arcEnd = CAMERA_ARC_END,
}: ChapterGradingProps) {
  const scene = useThree((state) => state.scene);
  const scroll = useScroll();
  const grades = useMemo(() => (isLight ? LIGHT_GRADES : DARK_GRADES), [isLight]);
  const contactGrade = useMemo(() => {
    const skyGrade = createGradeTarget();
    sampleGrade(grades, 1, skyGrade);
    return {
      ends: [createGradeTarget(), skyGrade] as const,
      revision: -1,
      departed: false,
      mode: 'outside' as ContactMode,
      progress: Number.NaN,
      arc: Number.NaN,
    };
  }, [grades]);

  const captureGrade = (out: GradeTarget) => {
    sampleGrade(grades, mapScrollToArc(scroll?.offset ?? 0, arcEnd, getCameraFreezes()), out);
    if (ambientRef.current) out.ambient = ambientRef.current.intensity;
    if (keyLightRef.current) {
      out.directional = keyLightRef.current.intensity;
      out.keyColor.copy(keyLightRef.current.color);
    }
    if (scene?.fog instanceof THREE.Fog) {
      out.fogNear = scene.fog.near;
      out.fogFar = scene.fog.far;
      out.fogColor.copy(scene.fog.color);
    }
  };

  useFrame((state, delta) => {
    // Damping is exponential in elapsed time, so a grade advanced only on
    // drawn frames lands in exactly the same place as one advanced on all of
    // them -- it simply is not computed for images that are never shown.
    if (!isFrameDrawn(state.clock.elapsedTime)) return;

    const contact = getContactView();
    const sky = contact.mode !== 'outside';
    const mappedReturn = contact.mode === 'returning' && !contactGrade.departed;
    const arc = !sky || mappedReturn
      ? mapScrollToArc(scroll?.offset ?? 0, arcEnd, getCameraFreezes()) : Number.NaN;
    if (sky) {
      if (contactGrade.mode === contact.mode && contactGrade.progress === contact.progress &&
          (contact.mode === 'parked' || contactGrade.revision === contact.revision) &&
          (!mappedReturn || contactGrade.arc === arc)) return;
      const [tvGrade, skyGrade] = contactGrade.ends;
      if (contact.mode === 'parked') sampleGrade(grades, 1, target);
      else {
        if (contactGrade.revision !== contact.revision) {
          contactGrade.revision = contact.revision;
          if (contact.mode === 'departing') {
            captureGrade(tvGrade);
            sampleGrade(grades, 1, skyGrade);
            contactGrade.departed = true;
          } else {
            captureGrade(skyGrade);
          }
        }
        if (mappedReturn) sampleGrade(grades, arc, tvGrade);
        sampleGrade(contactGrade.ends, easeInOutCubic(contact.progress), target);
      }
    } else sampleGrade(grades, arc, target);
    contactGrade.mode = contact.mode;
    contactGrade.progress = sky ? contact.progress : Number.NaN;
    contactGrade.arc = arc;

    // Reduced motion still gets the grade, just without the easing: the point
    // is the depth and colour of the shot, not the transition.
    const step = sky || getPrefersReducedMotion()
      ? 1
      : 1 - Math.exp(-GRADE_DAMPING * Math.min(drawnFrameDelta(state.clock.elapsedTime, delta ?? 0), MAX_FRAME_DELTA));

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
