/*
 * Water from three.js r161, with explicit render-target ownership and
 * exception-safe renderer restoration. Shader and reflection math are unchanged.
 * https://github.com/mrdoob/three.js/blob/r161/examples/jsm/objects/Water.js
 *
 * The MIT License
 *
 * Copyright © 2010-2024 three.js authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Original work: Slayvin's flat mirror, stemkoski's water shader and 29a.ch's
 * WebGL water explanations, as credited by the upstream implementation.
 */

import * as THREE from 'three';
import type { WaterOptions } from 'three/examples/jsm/objects/Water.js';

const vertexShader = /* glsl */`
  uniform mat4 textureMatrix;
  uniform float time;

  varying vec4 mirrorCoord;
  varying vec4 worldPosition;

  #include <common>
  #include <fog_pars_vertex>
  #include <shadowmap_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    mirrorCoord = modelMatrix * vec4( position, 1.0 );
    worldPosition = mirrorCoord.xyzw;
    mirrorCoord = textureMatrix * mirrorCoord;
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;

    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
    #include <shadowmap_vertex>
  }`;

const fragmentShader = /* glsl */`
  uniform sampler2D mirrorSampler;
  uniform float alpha;
  uniform float time;
  uniform float size;
  uniform float distortionScale;
  uniform sampler2D normalSampler;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  uniform vec3 eye;
  uniform vec3 waterColor;

  varying vec4 mirrorCoord;
  varying vec4 worldPosition;

  vec4 getNoise( vec2 uv ) {
    vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
    vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
    vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
    vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
    vec4 noise = texture2D( normalSampler, uv0 ) +
      texture2D( normalSampler, uv1 ) +
      texture2D( normalSampler, uv2 ) +
      texture2D( normalSampler, uv3 );
    return noise * 0.5 - 1.0;
  }

  void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {
    vec3 reflection = normalize( reflect( -sunDirection, surfaceNormal ) );
    float direction = max( 0.0, dot( eyeDirection, reflection ) );
    specularColor += pow( direction, shiny ) * sunColor * spec;
    diffuseColor += max( dot( sunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;
  }

  #include <common>
  #include <packing>
  #include <bsdfs>
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    vec4 noise = getNoise( worldPosition.xz * size );
    vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );
    vec3 diffuseLight = vec3(0.0);
    vec3 specularLight = vec3(0.0);
    vec3 worldToEye = eye-worldPosition.xyz;
    vec3 eyeDirection = normalize( worldToEye );
    sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );
    float distance = length(worldToEye);
    vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;
    vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );
    float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
    float rf0 = 0.3;
    float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );
    vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
    vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), ( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight ), reflectance);
    vec3 outgoingLight = albedo;
    gl_FragColor = vec4( outgoingLight, alpha );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

/**
 * Stock Water hides its render target inside a closure and has no disposer.
 * This surface owns only its reflection target and material: geometry belongs
 * to Ocean, and normal/shore textures belong to R3F's shared loader cache.
 */
export class OwnedWater extends THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  readonly isWater = true;
  readonly reflectionTarget: THREE.WebGLRenderTarget;
  private disposed = false;

  constructor(geometry: THREE.BufferGeometry, options: WaterOptions = {}) {
    const textureMatrix = new THREE.Matrix4();
    const eye = options.eye ?? new THREE.Vector3();
    const renderTarget = new THREE.WebGLRenderTarget(options.textureWidth ?? 512, options.textureHeight ?? 512);
    const material = new THREE.ShaderMaterial({
      name: 'MirrorShader',
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        THREE.UniformsLib.lights,
        {
          normalSampler: { value: null },
          mirrorSampler: { value: null },
          alpha: { value: options.alpha ?? 1 },
          time: { value: options.time ?? 0 },
          size: { value: 1 },
          distortionScale: { value: options.distortionScale ?? 20 },
          textureMatrix: { value: null },
          sunColor: { value: new THREE.Color(options.sunColor ?? 0xffffff) },
          sunDirection: { value: options.sunDirection ?? new THREE.Vector3(0.70707, 0.70707, 0) },
          eye: { value: null },
          waterColor: { value: new THREE.Color(options.waterColor ?? 0x7f7f7f) },
        },
      ]),
      vertexShader,
      fragmentShader,
      lights: true,
      side: options.side ?? THREE.FrontSide,
      fog: options.fog ?? false,
    });
    material.uniforms.mirrorSampler.value = renderTarget.texture;
    material.uniforms.normalSampler.value = options.waterNormals ?? null;
    material.uniforms.textureMatrix.value = textureMatrix;
    material.uniforms.eye.value = eye;
    // Preserve the upstream option's live vector, not UniformsUtils' clone.
    if (options.sunDirection) material.uniforms.sunDirection.value = options.sunDirection;
    super(geometry, material);
    this.reflectionTarget = renderTarget;

    const mirrorPlane = new THREE.Plane();
    const normal = new THREE.Vector3();
    const mirrorWorldPosition = new THREE.Vector3();
    const cameraWorldPosition = new THREE.Vector3();
    const rotationMatrix = new THREE.Matrix4();
    const lookAtPosition = new THREE.Vector3(0, 0, -1);
    const clipPlane = new THREE.Vector4();
    const view = new THREE.Vector3();
    const target = new THREE.Vector3();
    const q = new THREE.Vector4();
    const mirrorCamera = new THREE.PerspectiveCamera();
    const clipBias = options.clipBias ?? 0;

    this.onBeforeRender = (renderer, scene, camera) => {
      if (this.disposed) return;
      mirrorWorldPosition.setFromMatrixPosition(this.matrixWorld);
      cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
      rotationMatrix.extractRotation(this.matrixWorld);
      normal.set(0, 0, 1).applyMatrix4(rotationMatrix);
      view.subVectors(mirrorWorldPosition, cameraWorldPosition);
      if (view.dot(normal) > 0) return;

      view.reflect(normal).negate().add(mirrorWorldPosition);
      rotationMatrix.extractRotation(camera.matrixWorld);
      lookAtPosition.set(0, 0, -1).applyMatrix4(rotationMatrix).add(cameraWorldPosition);
      target.subVectors(mirrorWorldPosition, lookAtPosition).reflect(normal).negate().add(mirrorWorldPosition);
      mirrorCamera.position.copy(view);
      mirrorCamera.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
      mirrorCamera.lookAt(target);
      mirrorCamera.far = (camera as THREE.PerspectiveCamera).far;
      mirrorCamera.updateMatrixWorld();
      mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);

      textureMatrix.set(
        0.5, 0, 0, 0.5,
        0, 0.5, 0, 0.5,
        0, 0, 0.5, 0.5,
        0, 0, 0, 1,
      );
      textureMatrix.multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
      mirrorPlane.setFromNormalAndCoplanarPoint(normal, mirrorWorldPosition);
      mirrorPlane.applyMatrix4(mirrorCamera.matrixWorldInverse);
      clipPlane.set(mirrorPlane.normal.x, mirrorPlane.normal.y, mirrorPlane.normal.z, mirrorPlane.constant);

      const projection = mirrorCamera.projectionMatrix.elements;
      q.x = (Math.sign(clipPlane.x) + projection[8]) / projection[0];
      q.y = (Math.sign(clipPlane.y) + projection[9]) / projection[5];
      q.z = -1;
      q.w = (1 + projection[10]) / projection[14];
      clipPlane.multiplyScalar(2 / clipPlane.dot(q));
      projection[2] = clipPlane.x;
      projection[6] = clipPlane.y;
      projection[10] = clipPlane.z + 1 - clipBias;
      projection[14] = clipPlane.w;
      eye.setFromMatrixPosition(camera.matrixWorld);

      const previousTarget = renderer.getRenderTarget();
      const previousXr = renderer.xr.enabled;
      const previousShadows = renderer.shadowMap.autoUpdate;
      const previousVisible = this.visible;
      this.visible = false;
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      try {
        renderer.setRenderTarget(renderTarget);
        renderer.state.buffers.depth.setMask(true);
        if (!renderer.autoClear) renderer.clear();
        renderer.render(scene, mirrorCamera);
      } finally {
        this.visible = previousVisible;
        renderer.xr.enabled = previousXr;
        renderer.shadowMap.autoUpdate = previousShadows;
        renderer.setRenderTarget(previousTarget);
        const viewport = (camera as THREE.Camera & { viewport?: THREE.Vector4 }).viewport;
        if (viewport) renderer.state.viewport(viewport);
      }
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // The target's dispose event releases its framebuffer, texture and depth
    // renderbuffer together. Disposing the sampler texture alone cannot do it.
    this.reflectionTarget.dispose();
    this.material.dispose();
  }
}
