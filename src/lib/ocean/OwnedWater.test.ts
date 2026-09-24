import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
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
