import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Image-based lighting, generated on the device.
 *
 * drei's `<Environment preset>` resolves to an HDR file on raw.githack.com --
 * a third-party host, several megabytes, fetched before the metallic surfaces
 * in the scene light correctly, and then decoded and pre-filtered on the main
 * thread. On a slow connection the island renders flat until it lands.
 *
 * RoomEnvironment builds an equivalent lighting probe procedurally: a handful
 * of emissive boxes rendered once through the PMREM generator. No request, no
 * HDR decode, and a probe indistinguishable from the preset at the roughness
 * these materials use.
 */

export function LocalEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    if (!gl || !scene) return;

    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);

    const previous = scene.environment;
    scene.environment = target.texture;

    return () => {
      scene.environment = previous ?? null;
      target.dispose();
      pmrem.dispose();
      // RoomEnvironment builds real geometry and materials; without this they
      // outlive the probe they were only ever used to bake.
      room.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry?.dispose();
        const material = child.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material?.dispose();
      });
    };
  }, [gl, scene]);

  return null;
}
