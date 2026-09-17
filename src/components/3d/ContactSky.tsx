import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CONTACT_SKY_ORIENTATION, CONTACT_SKY_POSITION } from '@/lib/camera/contactFlight';
import {
  CONTACT_CLOUD_LAYER,
  getContactCloudOpacity,
  getContactCloudQuads,
  type ContactCloudTexture,
} from '@/lib/contact/contactClouds';
import { getContactView } from '@/lib/contact/contactScene';
import { getGpuTier } from '@/lib/gateways/gpuTier';
import { isFrameDrawn } from '@/lib/render/frameGate';

type CloudMesh = THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

interface CloudBatch {
  textureName: ContactCloudTexture;
  mesh: CloudMesh;
  texture: THREE.Texture | null;
  textureReleased: boolean;
  status: 'loading' | 'ready' | 'deferred' | 'failed';
  deferredRevision: number;
  isLight: boolean | null;
}

interface CloudScene {
  root: THREE.Group;
  batches: CloudBatch[];
  readyCount: number;
  revision: number;
  drawnRevision: number;
  flightRevision: number;
  opacity: number;
  isLight: boolean | null;
}

function releaseTexture(batch: CloudBatch): void {
  if (!batch.texture || batch.textureReleased) return;
  batch.textureReleased = true;
  batch.texture.dispose();
}

const TEXTURES = ['body', 'vapor'] as const;
const LIGHT_CLOUDS = {
  body: { color: '#bfced9', opacity: 0.52 },
  vapor: { color: '#ffffff', opacity: 0.48 },
};
const DARK_CLOUDS = {
  body: { color: '#b7c7ca', opacity: 0.34 },
  vapor: { color: '#bdcdd1', opacity: 0.16 },
};

export function ContactSky({ isLight }: { isLight: boolean }) {
  const scene = useThree(state => state.scene);
  const camera = useThree(state => state.camera);
  const cloudsRef = useRef<CloudScene | null>(null);

  useEffect(() => {
    // The horizon owns layer 1; Water's default-layer mirror must see neither.
    const wasEnabled = camera.layers.isEnabled(CONTACT_CLOUD_LAYER);
    camera.layers.enable(CONTACT_CLOUD_LAYER);
    return () => {
      if (wasEnabled) camera.layers.enable(CONTACT_CLOUD_LAYER);
      else camera.layers.disable(CONTACT_CLOUD_LAYER);
    };
  }, [camera]);

  useEffect(() => {
    const quads = getContactCloudQuads(getGpuTier());
    const root = new THREE.Group();
    root.name = 'Contact sky';
    root.visible = false;
    root.layers.set(CONTACT_CLOUD_LAYER);
    root.position.copy(CONTACT_SKY_POSITION);
    root.quaternion.copy(CONTACT_SKY_ORIENTATION);
    root.matrixAutoUpdate = false;
    root.updateMatrix();

    const geometry = new THREE.PlaneGeometry(1, 1);
    const transform = new THREE.Object3D();
    const clouds: CloudScene = {
      root, batches: [], readyCount: 0, revision: 0, drawnRevision: -1,
      flightRevision: -1, opacity: 0, isLight: null,
    };
    for (const textureName of TEXTURES) {
      const instances = quads.filter(quad => quad.texture === textureName);
      if (instances.length === 0) continue;
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        fog: true,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
      mesh.name = `Contact clouds: ${textureName}`;
      mesh.visible = false;
      mesh.layers.set(CONTACT_CLOUD_LAYER);
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = textureName === 'vapor' ? 1 : 0;
      instances.forEach((quad, index) => {
        transform.position.set(quad.x, quad.y, -quad.depth);
        transform.rotation.set(0, 0, quad.rotation);
        transform.scale.set(quad.width, quad.height, 1);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      root.add(mesh);
      clouds.batches.push({
        textureName, mesh, texture: null, textureReleased: false,
        status: 'loading', deferredRevision: -1, isLight: null,
      });
    }
    scene.add(root);
    root.updateMatrixWorld(true);
    root.matrixWorldAutoUpdate = false;
    for (const batch of clouds.batches) batch.mesh.matrixWorldAutoUpdate = false;
    cloudsRef.current = clouds;

    // Optional images have their own manager, never Suspense or critical-asset receipts.
    const loader = new THREE.TextureLoader(new THREE.LoadingManager());
    let disposed = false;
    for (const batch of clouds.batches) {
      const url = `/textures/hero-cloud/${batch.textureName}.webp`;
      const texture = loader.load(url, loaded => {
        batch.texture = loaded;
        batch.textureReleased = false;
        if (disposed || batch.status === 'failed') {
          // TextureLoader can finish populating an owned texture after cleanup.
          releaseTexture(batch);
          return;
        }
        if (batch.status !== 'loading') return;
        const view = getContactView();
        const opacity = getContactCloudOpacity(view.mode, view.progress);
        // Admit new banks before the shared reveal, never into an already visible flight or park.
        if (view.mode !== 'outside' && (view.mode !== 'departing' || opacity > 0)) {
          batch.status = 'deferred';
          batch.deferredRevision = view.revision;
          return;
        }
        batch.status = 'ready';
        clouds.readyCount++;
        clouds.revision++;
      }, undefined, error => {
        if (disposed || batch.status === 'failed') return;
        if (batch.status === 'ready') {
          clouds.readyCount--;
          clouds.revision++;
        }
        batch.status = 'failed';
        releaseTexture(batch);
        console.warn(
          `[ContactSky] Optional texture ${url} failed; omitting its cloud quads. Contact content remains available.`,
          error,
        );
      });
      batch.texture = texture;
      // A synchronous error can precede TextureLoader handing ownership back to us.
      if (batch.status === 'failed') releaseTexture(batch);
      else {
        texture.colorSpace = THREE.SRGBColorSpace;
        batch.mesh.material.map = texture;
      }
    }

    return () => {
      disposed = true;
      cloudsRef.current = null;
      scene.remove(root);
      root.clear();
      for (const batch of clouds.batches) {
        releaseTexture(batch);
        batch.mesh.material.dispose();
        batch.mesh.dispose();
      }
      geometry.dispose();
    };
  }, [scene]);

  useFrame(state => {
    const clouds = cloudsRef.current;
    if (!clouds) return;
    const view = getContactView();
    const opacity = getContactCloudOpacity(view.mode, view.progress);
    if (view.mode === 'departing' && opacity === 0 && clouds.flightRevision !== view.revision) {
      clouds.flightRevision = view.revision;
      for (let index = 0; index < clouds.batches.length; index++) {
        const batch = clouds.batches[index];
        if (batch.status !== 'deferred' || batch.deferredRevision === view.revision) continue;
        batch.status = 'ready';
        clouds.readyCount++;
        clouds.revision++;
      }
    }
    if (opacity === 0 || clouds.readyCount === 0) {
      if (clouds.root.visible && isFrameDrawn(state.clock.elapsedTime)) clouds.root.visible = false;
      return;
    }
    if (clouds.root.visible && clouds.opacity === opacity && clouds.isLight === isLight &&
        clouds.drawnRevision === clouds.revision) return;
    if (!isFrameDrawn(state.clock.elapsedTime)) return;

    const palette = isLight ? LIGHT_CLOUDS : DARK_CLOUDS;
    for (let index = 0; index < clouds.batches.length; index++) {
      const batch = clouds.batches[index];
      if (batch.status !== 'ready') {
        if (batch.mesh.visible) batch.mesh.visible = false;
        continue;
      }
      const paint = palette[batch.textureName];
      const material = batch.mesh.material;
      if (batch.isLight !== isLight) {
        material.color.set(paint.color);
        const toneMapped = !isLight;
        if (material.toneMapped !== toneMapped) {
          material.toneMapped = toneMapped;
          material.needsUpdate = true;
        }
        batch.isLight = isLight;
      }
      const alpha = opacity * paint.opacity;
      if (material.opacity !== alpha) material.opacity = alpha;
      if (!batch.mesh.visible) batch.mesh.visible = true;
    }
    if (!clouds.root.visible) clouds.root.visible = true;
    clouds.opacity = opacity;
    clouds.isLight = isLight;
    clouds.drawnRevision = clouds.revision;
  });

  return null;
}
