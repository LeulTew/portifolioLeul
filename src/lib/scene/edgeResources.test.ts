import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  bindHorizonBackground,
  createEdgeResources,
  enableHorizonLayer,
  HORIZON_LAYER,
} from './edgeResources';
import { DARK_GRADES, LIGHT_GRADES } from '@/lib/atmosphere/chapterGrade';

function createTerrain(color = '#e9e2d4') {
  const map = new THREE.Texture();
  map.minFilter = THREE.LinearFilter;
  map.generateMipmaps = false;
  const material = new THREE.MeshStandardMaterial({ color, map });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  return { mesh, material, map };
}

describe('scene edge resource ownership', () => {
  it('borrows the actual uploaded albedo without modifying or cloning it', () => {
    const { mesh, map, material } = createTerrain();
    const clone = vi.spyOn(map, 'clone');
    const edges = createEdgeResources(mesh);
    expect(edges.skirt.material.map).toBe(map);
    expect(edges.skirt.material.color).toEqual(material.color);
    expect(edges.skirt.material.roughness).toBe(material.roughness);
    expect(edges.skirt.material.metalness).toBe(material.metalness);
    expect(edges.skirt.material.envMapIntensity).toBe(material.envMapIntensity);
    expect(edges.land.material).toBe(edges.skirt.material);
    expect(edges.land.material.map).toBe(map);
    expect(clone).not.toHaveBeenCalled();
    expect(map.minFilter).toBe(THREE.LinearFilter);
    expect(map.generateMipmaps).toBe(false);
    edges.dispose();
    mesh.geometry.dispose();
    material.dispose();
    map.dispose();
  });

  it('disposes only its three geometries and two materials, once', () => {
    const { mesh, map, material } = createTerrain();
    const edges = createEdgeResources(mesh);
    const owned = [edges.skirt.geometry, edges.land.geometry, edges.horizon.geometry, edges.skirt.material, edges.horizon.material];
    const ownedDisposals = owned.map((resource) => vi.spyOn(resource, 'dispose'));
    const borrowed = [vi.spyOn(map, 'dispose'), vi.spyOn(material, 'dispose'), vi.spyOn(mesh.geometry, 'dispose')];
    edges.dispose();
    edges.dispose();
    ownedDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    borrowed.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
    mesh.geometry.dispose();
    material.dispose();
    map.dispose();
  });

  it('rebinds a theme-owned clone without disposing either terrain map', () => {
    const light = createTerrain();
    const dark = createTerrain('#0a1a1a');
    const lightDispose = vi.spyOn(light.map, 'dispose');
    const darkDispose = vi.spyOn(dark.map, 'dispose');
    const oldEdges = createEdgeResources(light.mesh);
    const newEdges = createEdgeResources(dark.mesh);
    oldEdges.dispose();
    expect(newEdges.skirt.material.map).toBe(dark.map);
    expect(newEdges.skirt.material.color).toEqual(dark.material.color);
    expect(lightDispose).not.toHaveBeenCalled();
    expect(darkDispose).not.toHaveBeenCalled();
    newEdges.dispose();
    for (const terrain of [light, dark]) {
      terrain.mesh.geometry.dispose();
      terrain.material.dispose();
      terrain.map.dispose();
    }
  });

  it('uses opaque, depth-tested surfaces without new shadow or reflection work', () => {
    const { mesh, map, material } = createTerrain();
    const edges = createEdgeResources(mesh);
    for (const edge of [edges.skirt, edges.land, edges.horizon]) {
      expect(edge.material.transparent).toBe(false);
      expect(edge.material.depthWrite).toBe(true);
      expect(edge.material.depthTest).toBe(true);
      expect(edge.castShadow).toBe(false);
      expect(edge.receiveShadow).toBe(false);
      expect(edge.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
    }
    const main = new THREE.PerspectiveCamera();
    const mirror = new THREE.PerspectiveCamera();
    const restore = enableHorizonLayer(main);
    expect(main.layers.test(edges.skirt.layers)).toBe(true);
    expect(mirror.layers.test(edges.skirt.layers)).toBe(true);
    expect(main.layers.test(edges.land.layers)).toBe(true);
    expect(mirror.layers.test(edges.land.layers)).toBe(true);
    expect(main.layers.test(edges.horizon.layers)).toBe(true);
    expect(mirror.layers.test(edges.horizon.layers)).toBe(false);
    restore();
    edges.dispose();
    mesh.geometry.dispose();
    material.dispose();
    map.dispose();
  });

  it('preserves camera pose, projection and all unowned layer bits', () => {
    const camera = new THREE.PerspectiveCamera(50, 1.7, 0.1, 1000);
    camera.position.set(-23, 6, -22);
    camera.layers.enable(4);
    const position = camera.position.clone();
    const projection = camera.projectionMatrix.clone();
    const restore = enableHorizonLayer(camera);
    camera.layers.enable(7);
    restore();
    expect(camera.position).toEqual(position);
    expect(camera.projectionMatrix).toEqual(projection);
    expect(camera.layers.mask).toBe((1 << 0) | (1 << 4) | (1 << 7));

    camera.layers.enable(HORIZON_LAYER);
    const restoreExisting = enableHorizonLayer(camera);
    restoreExisting();
    expect(camera.layers.isEnabled(HORIZON_LAYER)).toBe(true);
  });

  it('lets Three update the real fog and encodes only the unlit background', () => {
    const { mesh, map, material } = createTerrain();
    const edges = createEdgeResources(mesh);
    const scene = new THREE.Scene();
    for (const [grades, background] of [
      [LIGHT_GRADES, '#f4f7ff'],
      [DARK_GRADES, '#001a1a'],
    ] as const) {
      scene.background = new THREE.Color(background);
      scene.fog = new THREE.Fog(grades[0].fogColor, 30, 70);
      bindHorizonBackground(edges.horizon.material, scene);
      const backgroundReference = edges.horizon.material.uniforms.backgroundColor.value;
      for (const grade of grades) {
        scene.fog.color.copy(grade.fogColor);
        expect(edges.horizon.material.fog).toBe(true);
        expect(edges.horizon.material.toneMapped).toBe(false);
        expect(backgroundReference).toBe(scene.background);
        expect(edges.horizon.material.uniforms.fogColor).toBeDefined();
      }
    }
    expect(edges.horizon.material.fragmentShader).toContain('linearToOutputTexel(vec4(backgroundColor, 1.0))');
    expect(edges.horizon.material.fragmentShader).not.toContain('#include <colorspace_fragment>');
    expect(edges.horizon.material.fragmentShader).toContain('if (vViewDepth < fogFar) discard');
    expect(edges.horizon.material.uniforms.waterAlpha.value).toBe(0.92);
    edges.dispose();
    mesh.geometry.dispose();
    material.dispose();
    map.dispose();
  });

  it('matches the existing dark-water alpha instead of retuning the ocean', () => {
    const { mesh, map, material } = createTerrain('#0a1a1a');
    const edges = createEdgeResources(mesh, 'dark');
    expect(edges.horizon.material.uniforms.waterAlpha.value).toBe(0.95);
    edges.dispose();
    mesh.geometry.dispose();
    material.dispose();
    map.dispose();
  });

  it('surfaces an invalid mount rather than silently creating a different landscape', () => {
    expect(() => createEdgeResources(new THREE.Group())).toThrow('terrain albedo');
    const { mesh, map, material } = createTerrain();
    const edges = createEdgeResources(mesh);
    expect(() => bindHorizonBackground(edges.horizon.material, new THREE.Scene())).toThrow('background and fog');
    edges.dispose();
    mesh.geometry.dispose();
    material.dispose();
    map.dispose();
  });
});
