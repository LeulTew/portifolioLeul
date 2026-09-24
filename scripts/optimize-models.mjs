import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, simplify } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const directory = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');
const models = [
  ['terrain-opt.glb', 'terrain-software.glb', true],
  ['me-animated-lite.glb', 'me-animated-software.glb', false],
];
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

const stats = document => ({
  vertices: document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())
    .reduce((sum, primitive) => sum + primitive.getAttribute('POSITION').getCount(), 0),
  triangles: document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())
    .reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3, 0),
  meshes: document.getRoot().listMeshes().length,
  skins: document.getRoot().listSkins().length,
  animations: document.getRoot().listAnimations().length,
});

for (const [source, output, terrain] of models) {
  const document = await io.read(join(directory, source));
  const before = stats(document);
  if (terrain) {
    // The software terrain uses runtime flat shading. Removing split face
    // normals before welding avoids processing three vertices for every face.
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) primitive.setAttribute('NORMAL', null);
    }
  }
  await document.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: terrain ? 0.001 : 0.005, lockBorder: terrain }),
    prune({ keepAttributes: true, keepLeaves: true, keepSolidTextures: true, keepExtras: true }),
    meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16 }),
  );
  const after = stats(document);
  if (after.animations !== before.animations || after.skins !== before.skins || after.meshes !== before.meshes) {
    throw new Error(`Software LOD changed scene structure: ${source}`);
  }
  await io.write(join(directory, output), document);
  console.log(JSON.stringify({ source, output, before, after }));
}
