import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { drawnFrameDelta, isFrameDrawn, isWorldOccluded } from '@/lib/render/frameGate';
import { getContactView } from '@/lib/contact/contactScene';
import {
  advancePrismExperiment, getPrismExperiment, resetPrismExperiment, setPrismAvailable, subscribePrismReset,
} from '@/lib/prism/prismExperiment';
import { PrismStrandGeometry, prismEase, prismPose } from '@/lib/prism/prismGeometry';
import { PrismProjection } from '@/lib/prism/prismProjection';

export function GreenPrism({ isLight }: { isLight: boolean }) {
  const root = useRef<THREE.Group>(null);
  const figure = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const cage = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(() => ({
    rest: new THREE.BoxGeometry(0.3, 12, 0.3),
    wire: new THREE.BoxGeometry(0.4, 12.2, 0.4),
    strand: new PrismStrandGeometry(),
  }), []);
  const materials = useMemo(() => ({
    rest: isLight
      ? new THREE.MeshStandardMaterial({ color: '#0a6b4a', metalness: 0.15, roughness: 0.4,
        emissive: '#04402a', emissiveIntensity: 0.4 })
      : new THREE.MeshBasicMaterial({ color: '#00ff9d', transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending }),
    wire: new THREE.MeshBasicMaterial({ color: isLight ? '#11b978' : '#00ff9d', wireframe: true,
      transparent: true, opacity: isLight ? 0.25 : 0.4, blending: THREE.AdditiveBlending }),
    strand: new THREE.MeshStandardMaterial({ color: isLight ? '#096c48' : '#4de8ad',
      metalness: 0.2, roughness: 0.3, emissive: isLight ? '#063c28' : '#075035',
      emissiveIntensity: isLight ? 0.35 : 0.8, side: THREE.FrontSide }),
    cage: new THREE.LineBasicMaterial({ color: isLight ? '#b3f5cf' : '#c1ffe3',
      transparent: true, opacity: 0.5, depthWrite: false }),
  }), [isLight]);
  const animation = useMemo(() => ({ revision: -1, yaw: 0, progress: -1,
    pose: { lift: 0, bend: 0 }, projection: new PrismProjection() }), []);

  useEffect(() => {
    const restore = () => {
      if (body.current) {
        body.current.geometry = geometry.rest;
        body.current.material = materials.rest;
      }
      if (figure.current) {
        figure.current.position.y = 0;
        figure.current.rotation.set(0, 0, -0.3, 'YXZ');
      }
      if (wire.current) wire.current.visible = true;
      if (cage.current) cage.current.visible = false;
      materials.wire.opacity = isLight ? 0.25 : 0.4;
      animation.progress = -1;
    };
    restore();
    const release = subscribePrismReset(restore);
    return () => {
      release();
      resetPrismExperiment();
      materials.rest.dispose(); materials.wire.dispose();
      materials.strand.dispose(); materials.cage.dispose();
    };
  }, [animation, geometry, materials, isLight]);
  useEffect(() => () => {
    setPrismAvailable(false);
    geometry.rest.dispose(); geometry.wire.dispose(); geometry.strand.dispose();
  }, [geometry]);

  useFrame((state, delta) => {
    if (!root.current || !figure.current || !body.current || !wire.current || !cage.current) return;
    if (document.hidden || isWorldOccluded() || getContactView().mode !== 'outside') {
      if (getPrismExperiment().phase !== 'rest') resetPrismExperiment();
      setPrismAvailable(false);
      return;
    }
    if (!isFrameDrawn(state.clock.elapsedTime)) return;
    const reduced = getPrefersReducedMotion();
    root.current.position.y = reduced ? 2 : 2 + Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    const view = getPrismExperiment();
    if (getPrismExperiment().phase !== 'rest') {
      let dt = drawnFrameDelta(state.clock.elapsedTime, delta) * 1000;
      if (animation.revision !== view.revision) {
        animation.revision = view.revision;
        animation.yaw = Math.atan2(state.camera.position.x - 12, state.camera.position.z + 15);
        dt = 0;
      }
      advancePrismExperiment(dt, reduced);
      if (view.phase !== 'rest') {
        if (view.reduced) {
          materials.wire.opacity = (isLight ? 0.25 : 0.4) + 0.2 * Math.sin(Math.PI * view.hold);
        } else {
          prismPose(view.progress, animation.pose);
          const { lift, bend } = animation.pose;
          if (animation.progress !== bend) {
            geometry.strand.update(bend);
            animation.progress = bend;
          }
          figure.current.position.y = lift;
          figure.current.rotation.set(0, animation.yaw * prismEase(bend), -0.3, 'YXZ');
          const bent = bend > 0;
          body.current.geometry = bent ? geometry.strand.body : geometry.rest;
          body.current.material = materials.strand;
          wire.current.visible = !bent;
          cage.current.visible = bent;
          materials.wire.opacity = (isLight ? 0.25 : 0.4) * (1 - prismEase(view.progress / 0.26));
          materials.cage.opacity = 0.5 * prismEase(bend / 0.12);
        }
      }
    }
    animation.projection.paint(body.current, state.camera, state.size.width, state.size.height);
  });

  return <group ref={root} position={[12, 2, -15]} name="green-prism" dispose={null}>
    <group ref={figure} rotation={[0, 0, -0.3]} name="green-prism-figure">
      <mesh ref={body} geometry={geometry.rest} material={materials.rest} castShadow />
      <mesh ref={wire} geometry={geometry.wire} material={materials.wire} />
      <lineSegments ref={cage} geometry={geometry.strand.cage} material={materials.cage} visible={false} />
    </group>
    <pointLight intensity={isLight ? 4 : 5} color={isLight ? '#00d17a' : '#00ff9d'}
      distance={20} decay={2} castShadow />
  </group>;
}
