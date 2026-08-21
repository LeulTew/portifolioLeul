---
name: threejs
description: Comprehensive 3D web graphics skill for Three.js, React Three Fiber (R3F), and Drei. Use when building 3D environments, loading and optimizing GLTF/GLB models, custom GLSL shaders, camera animations, lighting, instanced meshes, and WebGL lifecycle memory management.
---

# Three.js & React Three Fiber (R3F) Skill

## Overview
Three.js and React Three Fiber provide the standard foundation for high-performance 3D graphics on the web.

**When to use this skill:**
- Rendering interactive 3D avatars, terrains, islands, and models (`.glb` / `.gltf`)
- Camera choreographies and orbit controls (smooth lerping, target tracking)
- GLSL Shader materials (water shaders, holographic glows, noise distortions)
- 3D spatial raycasting and interactive mesh clicking/hovering
- Memory management, geometry disposal, and WebGL context loss prevention
- 60fps performance optimization and draw call minimization

## Key Best Practices
1. **Asset Optimization**: Compress GLTF models using DRACO or Meshopt compression (`gltf-pipeline`, `gltfpack`).
2. **WebGL Lifecycle & Disposal**: Always dispose geometries (`geometry.dispose()`), textures (`texture.dispose()`), and materials (`material.dispose()`) on component unmount.
3. **useFrame Optimization**: Avoid object allocations (`new THREE.Vector3()`) inside `useFrame` loops; reuse pre-allocated vectors/matrices.
4. **Instancing**: For repeating objects (particles, trees, stones), use `<instancedMesh>` or `<Instances>` instead of individual meshes.
5. **Lighting Budget**: Limit shadow-casting lights to 1 or 2; use Environment maps / HDR for ambient lighting.
6. **Canvas Configuration**: Set `dpr={[1, 2]}`, `gl={{ powerPreference: 'high-performance', antialias: true, alpha: true }}`.
