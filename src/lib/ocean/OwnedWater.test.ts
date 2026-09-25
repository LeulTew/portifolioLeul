import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { DEFAULT_WAVE_SETTINGS, maxWaveHeight } from '@/components/ocean/waveShader';
import { CONTACT_SKY_ORIENTATION, CONTACT_SKY_POSITION } from '@/lib/camera/contactFlight';
import { OwnedWater } from './OwnedWater';

function reflectionHarness() {
  const previous = new THREE.WebGLRenderTarget(16, 16);
  const renderer = {
    getRenderTarget: () => previous,
    setRenderTarget: vi.fn<(target: THREE.WebGLRenderTarget | null) => void>(),
    render: vi.fn<(scene: THREE.Scene, camera: THREE.Camera) => void>(),
    clear: vi.fn(),
    autoClear: false,
    xr: { enabled: true },
    shadowMap: { autoUpdate: true },
    state: { buffers: { depth: { setMask: vi.fn() } }, viewport: vi.fn() },
  };
  return { renderer, previous };
}

function reflect(water: Water | OwnedWater, camera: THREE.PerspectiveCamera, harness: ReturnType<typeof reflectionHarness>) {
  const scene = new THREE.Scene();
  scene.add(water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -4, 0);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  water.onBeforeRender(
    harness.renderer as unknown as THREE.WebGLRenderer,
    scene, camera, water.geometry, water.material, null!,
  );
}

describe('owned r161 water reflection', () => {
  it('keeps the stock shaders and reflection camera/texture projection unchanged', () => {
    const geometry = new THREE.PlaneGeometry();
    const options = { textureWidth: 256, textureHeight: 256, distortionScale: 2.25, fog: true };
    const original = new Water(geometry, options);
    const owned = new OwnedWater(geometry, options);
    const compact = (shader: string) => shader.replace(/\s/g, '');
    expect(compact(owned.material.vertexShader)).toBe(compact(original.material.vertexShader));
    expect(compact(owned.material.fragmentShader)).toBe(compact(original.material.fragmentShader));
    expect(Object.keys(owned.material.uniforms).sort()).toEqual(Object.keys(original.material.uniforms).sort());

    const baseline = reflectionHarness();
    const current = reflectionHarness();
    const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 1000);
    for (const position of [[15, 9, 30], [-4, 1, -8], [40, 23, -40]]) {
      camera.position.set(...position as [number, number, number]);
      camera.lookAt(0, -2, -20);
      reflect(original, camera, baseline);
      reflect(owned, camera, current);
      const sourceCamera = baseline.renderer.render.mock.calls.at(-1)![1];
      const ownedCamera = current.renderer.render.mock.calls.at(-1)![1];
      expect(ownedCamera.matrixWorld.toArray()).toEqual(sourceCamera.matrixWorld.toArray());
      expect(ownedCamera.projectionMatrix.toArray()).toEqual(sourceCamera.projectionMatrix.toArray());
      expect(owned.material.uniforms.textureMatrix.value.toArray()).toEqual(
        original.material.uniforms.textureMatrix.value.toArray(),
      );
      expect(owned.material.uniforms.eye.value.toArray()).toEqual(original.material.uniforms.eye.value.toArray());
    }
    expect(current.renderer.setRenderTarget).toHaveBeenCalledWith(owned.reflectionTarget);
    const baselineTarget = baseline.renderer.setRenderTarget.mock.calls[0][0]!;
    baselineTarget.dispose();
    original.material.dispose();
    owned.dispose();
    geometry.dispose();
    baseline.previous.dispose();
    current.previous.dispose();
  });

  it('disposes its complete target and material once, including before the first reflection', () => {
    const geometry = new THREE.PlaneGeometry();
    const normals = new THREE.Texture();
    const water = new OwnedWater(geometry, { waterNormals: normals });
    const target = vi.fn();
    const material = vi.fn();
    const sharedGeometry = vi.fn();
    const sharedNormals = vi.fn();
    water.reflectionTarget.addEventListener('dispose', target);
    water.material.addEventListener('dispose', material);
    geometry.addEventListener('dispose', sharedGeometry);
    normals.addEventListener('dispose', sharedNormals);
    water.dispose();
    water.dispose();
    expect(target).toHaveBeenCalledOnce();
    expect(material).toHaveBeenCalledOnce();
    expect(sharedGeometry).not.toHaveBeenCalled();
    expect(sharedNormals).not.toHaveBeenCalled();
    const harness = reflectionHarness();
    reflect(water, new THREE.PerspectiveCamera(), harness);
    expect(harness.renderer.render).not.toHaveBeenCalled();
    geometry.dispose();
    normals.dispose();
    harness.previous.dispose();
  });

  it('skips the reflection for a view that lies wholly above the crests, and resumes when the sea is back in view', () => {
    // Round 7 (TECH-009): parked Contact looks at the sky, yet the pass redrew the scene every frame.
    const geometry = new THREE.PlaneGeometry();
    const water = new OwnedWater(geometry, { crestHeight: maxWaveHeight(DEFAULT_WAVE_SETTINGS) });
    const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 2000);
    camera.position.set(0, 60, 0);
    camera.rotation.set(THREE.MathUtils.degToRad(40), 0, 0);
    const harness = reflectionHarness();
    reflect(water, camera, harness);
    expect(harness.renderer.render).not.toHaveBeenCalled();
    camera.rotation.set(THREE.MathUtils.degToRad(-10), 0, 0);
    reflect(water, camera, harness);
    expect(harness.renderer.render).toHaveBeenCalledOnce();
    water.dispose();
    geometry.dispose();
    harness.previous.dispose();
  });

  it('reflects a view that sees only the tallest crests, and any view when no bound is given', () => {
    // Round 8 (TECH-016): a margin of 4 sat below the 4.62 units the summed, shoaled swell can reach.
    const crest = maxWaveHeight(DEFAULT_WAVE_SETTINGS);
    expect(crest).toBeCloseTo(0.95 * 2.35 * 2.07, 10);
    const geometry = new THREE.PlaneGeometry();
    const bounded = new OwnedWater(geometry, { crestHeight: crest });
    const unbounded = new OwnedWater(geometry);
    const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 100);
    // Rest plane at -4: the view's lowest point sits between -4 + 4 and -4 + crest.
    camera.position.set(0, -4 + (4 + crest) / 2, 0);
    camera.rotation.set(THREE.MathUtils.degToRad(40), 0, 0);
    const seen = reflectionHarness();
    reflect(bounded, camera, seen);
    expect(seen.renderer.render).toHaveBeenCalledOnce();
    camera.position.set(0, 60, 0);
    const sky = reflectionHarness();
    reflect(unbounded, camera, sky);
    expect(sky.renderer.render).toHaveBeenCalledOnce();
    bounded.dispose();
    unbounded.dispose();
    geometry.dispose();
    seen.previous.dispose();
    sky.previous.dispose();
  });

  it.each([4 / 3, 16 / 10, 16 / 9, 21 / 9, 32 / 9])('still skips the reflection for parked Contact at aspect %f', aspect => {
    const geometry = new THREE.PlaneGeometry();
    const water = new OwnedWater(geometry, { crestHeight: maxWaveHeight(DEFAULT_WAVE_SETTINGS) });
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    camera.position.copy(CONTACT_SKY_POSITION);
    camera.quaternion.copy(CONTACT_SKY_ORIENTATION);
    const harness = reflectionHarness();
    reflect(water, camera, harness);
    expect(harness.renderer.render).not.toHaveBeenCalled();
    water.dispose();
    geometry.dispose();
    harness.previous.dispose();
  });

  it('restores the renderer and surface even when the reflection render throws', () => {
    const geometry = new THREE.PlaneGeometry();
    const water = new OwnedWater(geometry);
    const camera = new THREE.PerspectiveCamera() as THREE.PerspectiveCamera & { viewport: THREE.Vector4 };
    camera.position.set(2, 4, 8);
    camera.lookAt(0, -4, 0);
    camera.viewport = new THREE.Vector4(0, 0, 1440, 900);
    const harness = reflectionHarness();
    harness.renderer.render.mockImplementation(() => { throw new Error('context interrupted'); });
    expect(() => reflect(water, camera, harness)).toThrow('context interrupted');
    expect(water.visible).toBe(true);
    expect(harness.renderer.xr.enabled).toBe(true);
    expect(harness.renderer.shadowMap.autoUpdate).toBe(true);
    expect(harness.renderer.setRenderTarget).toHaveBeenLastCalledWith(harness.previous);
    expect(harness.renderer.state.viewport).toHaveBeenLastCalledWith(camera.viewport);
    water.dispose();
    geometry.dispose();
    harness.previous.dispose();
  });
});
