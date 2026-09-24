import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getCriticalAssets, getCriticalModels, resolveSceneModel } from './criticalAssets';

interface ModelDocument {
  accessors: { count: number }[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
  animations?: unknown[];
  skins?: unknown[];
  extensionsRequired?: string[];
}

function readModel(url: string): ModelDocument {
  const bytes = readFileSync(join(__dirname, '../../../public', url.slice(1)));
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('glTF');
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'));
}

describe('software graphics assets', () => {
  const originals = ['/models/terrain-opt.glb', '/models/me-animated-lite.glb'];

  it('uses one matching model set for prefetch and scene readiness', () => {
    const selected = originals.map(url => resolveSceneModel(url, true));
    expect(getCriticalModels(true)).toEqual(selected);
    expect(getCriticalAssets(true).filter(asset => asset.kind === 'model').map(asset => asset.url)).toEqual(selected);
    expect(originals.map(url => resolveSceneModel(url, false))).toEqual(originals);
    expect(getCriticalAssets(true).filter(asset => asset.kind !== 'model'))
      .toEqual(getCriticalAssets(false).filter(asset => asset.kind !== 'model'));
  });

  it.each(originals)('preserves the scene and animations while reducing vertices for %s', original => {
    const full = readModel(original);
    const compact = readModel(resolveSceneModel(original, true));
    const vertices = (model: ModelDocument) => model.meshes.flatMap(mesh => mesh.primitives)
      .reduce((sum, primitive) => sum + model.accessors[primitive.attributes.POSITION].count, 0);
    expect(vertices(compact)).toBeLessThan(vertices(full) * 0.5);
    expect(compact.meshes.length).toBe(full.meshes.length);
    expect(compact.animations?.length ?? 0).toBe(full.animations?.length ?? 0);
    expect(compact.skins?.length ?? 0).toBe(full.skins?.length ?? 0);
    expect(compact.extensionsRequired).toContain('EXT_meshopt_compression');
    full.meshes.forEach((mesh, index) => mesh.primitives.forEach((primitive, part) => {
      const attrs = compact.meshes[index].primitives[part].attributes;
      for (const name of ['TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) {
        if (name in primitive.attributes) expect(attrs).toHaveProperty(name);
      }
    }));
  });
});
