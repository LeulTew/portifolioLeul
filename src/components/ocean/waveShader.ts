import * as THREE from 'three';

/**
 * Real swell on three's Water, with surf that breaks on the actual coastline.
 *
 * Water gives a superb flat sea -- planar reflection, sun glitter, a normal
 * map for ripple -- and no waves at all: the surface never moves, and nothing
 * about it knows the island is there. What follows adds the motion and the
 * shore interaction while leaving all of that intact, by patching the shader
 * at compile time rather than replacing it.
 *
 * The waves are Gerstner (trochoidal), which is the standard model for deep
 * water and the reason the crests come out sharp and the troughs broad instead
 * of reading as a rolling sine. Each vertex is pushed along the direction of
 * travel as well as up, so the water piles into the crest the way it actually
 * does.
 *
 * What makes it read as surf rather than as a moving surface is the shore
 * field -- the baked distance-to-coast, see scripts/bake-shore-field.mjs.
 * Every wave term is modulated by it, so the sea does the four things a sea
 * does near land:
 *
 *   shoaling    amplitude grows as the water shallows, peaking just before
 *               the break line, because the same energy is carried in less
 *               depth
 *   bunching    wavelength shortens with it, so crests crowd toward the beach
 *   refraction  the direction of travel turns toward the shore normal, which
 *               is why waves arrive parallel to a beach whatever direction the
 *               swell came from
 *   breaking    amplitude collapses to nothing at the waterline, and the
 *               energy comes off as foam
 *
 * Foam has two sources, and they look different because they are: whitecaps
 * where a crest gets too steep to hold together, and the wash along the
 * waterline, which surges as each crest arrives and drains between them.
 */

/** Waves in the set. Unrolled in the shader, so this is a documented constant. */
export const WAVE_COUNT = 4;

export interface ShoreFieldLayout {
  /** World XZ of the field's minimum corner. */
  readonly origin: readonly [number, number];
  /** World units the field spans on each axis. */
  readonly extent: number;
  /** World units encoded at full black and full white. */
  readonly range: number;
  /** Edge of the baked image, in texels. Sets the gradient step. */
  readonly resolution: number;
}

/** Must match the constants in scripts/bake-shore-field.mjs. */
export const SHORE_FIELD_LAYOUT: ShoreFieldLayout = {
  origin: [-90, -110],
  extent: 180,
  range: 48,
  resolution: 512,
};

export interface WaveSettings {
  /** Overall wave height in world units. Zero leaves the sea flat. */
  amplitude: number;
  /** How far crests lean into their direction of travel, 0 to 1. */
  choppiness: number;
  /** Overall foam strength. */
  foam: number;
  /**
   * World units from the coast over which the sea counts as shallow.
   *
   * The whole surf zone -- shoaling, bunching, refraction and the break --
   * happens inside this band.
   */
  surfWidth: number;
}

export const DEFAULT_WAVE_SETTINGS: WaveSettings = {
  amplitude: 0.95,
  choppiness: 0.72,
  foam: 1,
  surfWidth: 30,
};

/**
 * Declarations and helpers, injected ahead of the vertex shader's main.
 *
 * `time` and `normalSampler` already exist in Water's uniform set; the waves
 * ride the same clock as the ripple so the two never drift apart.
 */
const VERTEX_HELPERS = /* glsl */ `
  uniform sampler2D shoreField;
  uniform vec2 shoreOrigin;
  uniform float shoreExtent;
  uniform float shoreRange;
  uniform float shoreTexel;
  uniform float waveAmplitude;
  uniform float waveChoppiness;
  uniform float surfWidth;

  varying vec3 vWaveNormal;
  varying float vFoam;
  varying float vShoreDepth;

  /** Signed distance to the coast in world units; negative inland. */
  float shoreDistance( vec2 worldXZ ) {
    vec2 uv = ( worldXZ - shoreOrigin ) / shoreExtent;
    return ( texture2D( shoreField, uv ).r - 0.5 ) * 2.0 * shoreRange;
  }

  /** Unit vector pointing out to sea, from the field's gradient. */
  vec2 seawardDirection( vec2 worldXZ ) {
    vec2 step = vec2( shoreTexel, 0.0 );
    float dx = shoreDistance( worldXZ + step.xy ) - shoreDistance( worldXZ - step.xy );
    float dz = shoreDistance( worldXZ + step.yx ) - shoreDistance( worldXZ - step.yx );
    vec2 gradient = vec2( dx, dz );
    float len = length( gradient );
    return len > 1e-5 ? gradient / len : vec2( 0.0, 1.0 );
  }

  /**
   * One Gerstner term. Displaces along the direction of travel as well as up,
   * which is what sharpens the crests, and accumulates the analytic normal so
   * the lighting follows the surface exactly rather than approximating it.
   */
  void addWave(
    inout vec3 offset, inout vec3 normal, inout float steepness,
    vec2 p, float t, vec2 direction, float wavenumber, float amplitude,
    float speed, float q
  ) {
    float phase = wavenumber * dot( direction, p ) - speed * t;
    float cosPhase = cos( phase );
    float sinPhase = sin( phase );

    offset.xz += direction * ( q * amplitude * cosPhase );
    offset.y += amplitude * sinPhase;

    float steep = wavenumber * amplitude;
    normal.x -= direction.x * steep * cosPhase;
    normal.z -= direction.y * steep * cosPhase;
    normal.y -= q * steep * sinPhase;

    // How close this term is to pinching its crest shut. Sums across the set,
    // so whitecaps appear where several crests arrive together.
    steepness += q * steep * max( sinPhase, 0.0 );
  }
`;

/** Replaces the body of the vertex shader's main, up to gl_Position. */
const VERTEX_BODY = /* glsl */ `
    vec4 wavePosition = modelMatrix * vec4( position, 1.0 );

    float shore = shoreDistance( wavePosition.xz );

    // 0 at the waterline, 1 once the sea is deep enough not to feel the bottom.
    float depth = clamp( shore / surfWidth, 0.0, 1.0 );

    /*
     * The break, and how far out it happens.
     *
     * A wave does not carry its full height up to the sand and stop there. It
     * peaks offshore, topples, and what runs up the beach past that point is
     * thin broken water. Ramping the height over the whole run-in rather than
     * over the last stretch is what keeps crests from standing higher than the
     * land they are arriving at -- which showed up, unmistakably, as white
     * shards of sea sitting on the coast.
     */
    float unbroken = smoothstep( 0.0, 0.30, depth );
    float shoaling = 1.0 + 1.35 * exp( -pow( ( depth - 0.44 ) / 0.20, 2.0 ) );

    /*
     * The swell only exists where the surface can hold it.
     *
     * The grid packs its rings around the island and stretches them out to the
     * horizon, so far from shore a single ring can be wider than a wavelength.
     * A wave sampled at less than a vertex per crest does not become a smaller
     * wave, it becomes noise: neighbouring vertices land on unrelated phases,
     * and the surface tears into hard triangular facets whose normals point
     * anywhere -- which reads as dark shards lying flat on the sea.
     *
     * So the waves fade out over the same distance the rings stop resolving
     * them, leaving the open water flat and carried by the normal map, exactly
     * as it was before. It is well past the fog by then in any case.
     */
    vec2 fieldCentre = shoreOrigin + shoreExtent * 0.5;
    float fromIsland = length( wavePosition.xz - fieldCentre );
    float withinReach = 1.0 - smoothstep(
      shoreExtent * 0.30, shoreExtent * 0.48, fromIsland
    );

    float gain = unbroken * shoaling * withinReach;

    // Crests crowd together as the water shallows.
    float bunching = mix( 0.5, 1.0, depth );

    // Refraction: by the time it lands, the swell is running at the coast
    // head-on, whichever way it set out.
    vec2 inbound = -seawardDirection( wavePosition.xz );
    float turn = 1.0 - depth * 0.8;

    vec3 waveOffset = vec3( 0.0 );
    vec3 waveNormal = vec3( 0.0, 1.0, 0.0 );
    float steepness = 0.0;

    float amp = waveAmplitude * gain;
    float q = waveChoppiness;

    // A short set of crossing swells. The first two carry the shape, the last
    // two are chop, which keeps the surface from reading as a repeating tile.
    addWave( waveOffset, waveNormal, steepness, wavePosition.xz, time,
      normalize( mix( vec2( 0.86, 0.51 ), inbound, turn ) ),
      0.052 / bunching, amp * 1.0, 1.05, q );
    addWave( waveOffset, waveNormal, steepness, wavePosition.xz, time,
      normalize( mix( vec2( -0.36, 0.93 ), inbound, turn ) ),
      0.081 / bunching, amp * 0.62, 1.32, q * 0.9 );
    addWave( waveOffset, waveNormal, steepness, wavePosition.xz, time,
      normalize( mix( vec2( 0.62, -0.78 ), inbound, turn * 0.55 ) ),
      0.164 / bunching, amp * 0.3, 1.9, q * 0.7 );
    addWave( waveOffset, waveNormal, steepness, wavePosition.xz, time,
      normalize( mix( vec2( -0.95, -0.31 ), inbound, turn * 0.35 ) ),
      0.283 / bunching, amp * 0.15, 2.5, q * 0.55 );

    wavePosition.xyz += waveOffset;

    vWaveNormal = normalize( waveNormal );
    vShoreDepth = depth;

    /*
     * The wash, in two parts, because a beach has two.
     *
     * There is always broken water in the last stretch onto the sand -- the
     * sea never fully drains -- and that is a thin, permanent line hugging the
     * coast. Everything further out only goes white when a crest actually
     * arrives, which is what makes the foam advance and retreat in bands
     * rather than sit there as a halo painted around the island.
     */
    float edge = 1.0 - smoothstep( 0.0, 0.05, depth );
    float band = 1.0 - smoothstep( 0.02, 0.24, depth );
    float surge = smoothstep( 0.12, 0.85, waveOffset.y / max( amp, 0.001 ) );
    float wash = max( edge * 0.58, band * surge );

    // Whitecaps, concentrated on the break line where the crests pitch over.
    float breakLine = exp( -pow( ( depth - 0.13 ) / 0.11, 2.0 ) );
    float whitecap = smoothstep( 0.42, 0.95, steepness );

    vFoam = clamp( max( wash, breakLine * whitecap * 1.35 ), 0.0, 1.0 );

    worldPosition = wavePosition;
    mirrorCoord = textureMatrix * wavePosition;
    vec4 mvPosition = viewMatrix * wavePosition;
    gl_Position = projectionMatrix * mvPosition`;

/**
 * The reflection offset, bounded.
 *
 * Water scales the offset by 1/distance, which is fine for a surface whose
 * normal only ever tilts as far as a ripple map allows. A swell tilts much
 * further, and close to the camera the two multiply into an offset that walks
 * clean off the reflection texture -- where it clamps to the edge and returns
 * whatever happens to be there, usually something very dark.
 */
const FRAGMENT_DISTORTION = /* glsl */ `
    vec2 distortion = clamp(
      surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale,
      vec2( -0.055 ), vec2( 0.055 )
    );`;

const FRAGMENT_HELPERS = /* glsl */ `
  uniform float foamAmount;

  varying vec3 vWaveNormal;
  varying float vFoam;
  varying float vShoreDepth;
`;

/**
 * The swell's own normal, with the ripple laid over it.
 *
 * Water derived its normal from the normal map alone, which is correct for a
 * flat sea and wrong the moment the surface has a shape: the reflection and
 * the sun glitter have to follow the crests, or the waves look painted on.
 */
const FRAGMENT_NORMAL = /* glsl */ `
    // The ripple's two horizontal components are noise.x and noise.y; noise.z
    // is the map's up axis, which is why Water swizzles it into place as
    // .xzy. Perturbing the swell with the up channel tilts every normal on the
    // sea by some forty degrees, and the reflection is then sampled from so
    // far off the surface that the water goes black.
    vec3 surfaceNormal = normalize(
      vWaveNormal + vec3( noise.x * 1.1, 0.0, noise.y * 1.1 )
    );`;

/**
 * Foam over the shaded water.
 *
 * Broken up by the same normal map the ripple uses, at a much larger scale, so
 * the edge of the wash is ragged rather than a clean contour of the baked
 * field -- which is the tell that would give away that a texture is driving it.
 */
const FRAGMENT_FOAM = /* glsl */ `
    float foamNoise = texture2D(
      normalSampler, worldPosition.xz * 0.021 + vec2( time * 0.014, time * -0.011 )
    ).g;
    float foamDetail = texture2D(
      normalSampler, worldPosition.xz * 0.075 - vec2( time * 0.03, time * 0.021 )
    ).b;

    float foam = smoothstep(
      0.33, 0.80, vFoam * ( 0.30 + 1.15 * foamNoise ) * ( 0.45 + 0.95 * foamDetail )
    ) * foamAmount;

    // Foam is bright, rough and unreflective: it is air in water, not a
    // surface. Washing it over the reflection is what sells it as spray.
    vec3 foamColor = vec3( 0.93, 0.97, 0.98 ) * ( 0.75 + 0.35 * foamDetail );
    vec3 outgoingLight = mix( albedo, foamColor, clamp( foam, 0.0, 1.0 ) );`;

export interface WaveMaterialOptions {
  shoreField: THREE.Texture;
  settings?: WaveSettings;
  layout?: ShoreFieldLayout;
}

/**
 * Patches a Water material in place so its surface carries the swell.
 *
 * Uses `onBeforeCompile`, so three's own shader stays the source of truth for
 * reflection, fog and shadowing, and this only adds to it.
 */
export function applyWaveShader(
  material: THREE.ShaderMaterial,
  { shoreField, settings = DEFAULT_WAVE_SETTINGS, layout = SHORE_FIELD_LAYOUT }: WaveMaterialOptions
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.shoreField = { value: shoreField };
    shader.uniforms.shoreOrigin = {
      value: new THREE.Vector2(layout.origin[0], layout.origin[1]),
    };
    shader.uniforms.shoreExtent = { value: layout.extent };
    shader.uniforms.shoreRange = { value: layout.range };
    // Two texels, so the gradient is measured across a real slope rather than
    // across the quantisation of a single step.
    shader.uniforms.shoreTexel = { value: (layout.extent / layout.resolution) * 2 };
    shader.uniforms.waveAmplitude = { value: settings.amplitude };
    shader.uniforms.waveChoppiness = { value: settings.choppiness };
    shader.uniforms.surfWidth = { value: settings.surfWidth };
    shader.uniforms.foamAmount = { value: settings.foam };

    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${VERTEX_HELPERS}\n\nvoid main() {`)
      .replace(
        /mirrorCoord\s*=\s*modelMatrix[\s\S]*?gl_Position\s*=\s*projectionMatrix\s*\*\s*mvPosition/,
        VERTEX_BODY
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${FRAGMENT_HELPERS}\n\nvoid main() {`)
      .replace(
        /vec3\s+surfaceNormal\s*=\s*normalize\([\s\S]*?\);/,
        FRAGMENT_NORMAL
      )
      .replace(
        /vec2\s+distortion\s*=\s*surfaceNormal\.xz[^;]*;/,
        FRAGMENT_DISTORTION
      )
      .replace(/vec3\s+outgoingLight\s*=\s*albedo;/, FRAGMENT_FOAM);
  };

  // Water's material is created before this runs, so the program built from
  // the unpatched source has to be discarded.
  material.needsUpdate = true;
}
