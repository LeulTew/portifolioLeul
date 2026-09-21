import * as THREE from 'three';
import { phaseFrameDelta } from '@/lib/motion/triggeredPhase';
import type { TVSource } from './tvState';

const vertexShader = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const fragmentShader = /* glsl */`
uniform sampler2D uVideo;
uniform float uReady;
uniform float uChannel;
uniform float uPower;
uniform float uReader;
uniform float uTune;
uniform float uTime;
uniform float uDetail;
uniform float uScreenPixels;
varying vec2 vUv;

vec3 testSignal(vec2 uv) {
  float column = floor(uv.x * 7.0);
  vec3 color = column < 1.0 ? vec3(.7) : column < 2.0 ? vec3(.7,.62,.05)
    : column < 3.0 ? vec3(.06,.63,.6) : column < 4.0 ? vec3(.08,.55,.15)
    : column < 5.0 ? vec3(.65,.09,.55) : column < 6.0 ? vec3(.62,.06,.05) : vec3(.04,.08,.5);
  if (uv.y < .22) {
    color = vec3(.025 + floor(uv.x * 9.0) * .012);
    float traceY = .10 + sin(uv.x * 26.0 + uTime * 1.6) * sin(uv.x * 3.14159) * .045;
    float trace = 1.0 - smoothstep(.003,.008,abs(uv.y-traceY));
    color += vec3(.48,.67,.54) * trace;
  }
  float center = length((uv - .5) * vec2(1.72,1.0));
  float ring = 1.0 - smoothstep(.006,.015,abs(center-.3));
  float cross = (1.0-smoothstep(.002,.006,abs(uv.x-.5))) +
    (1.0-smoothstep(.002,.006,abs(uv.y-.5)));
  return mix(color,vec3(.8,.83,.77),clamp((ring+cross)*.55,0.0,.85));
}
void main() {
  vec3 glass = vec3(.012,.021,.018);
  if (uReader > .5) {
    gl_FragColor = vec4(glass,1.0);
  } else {
    vec2 p = vUv * 2.0 - 1.0;
    vec2 warped = p * (1.0 + .025 * dot(p,p));
    vec2 uv = warped * .5 + .5;
    float power = clamp(uPower,0.0,1.0);
    float opened = smoothstep(.23,.85,power);
    float halfHeight = mix(.0025,.5,opened);
    float imageMask = 1.0-smoothstep(halfHeight,halfHeight+.009,abs(vUv.y-.5));
    imageMask *= smoothstep(0.0,.025,power);
    float edge = 1.0-smoothstep(.94,1.02,max(abs(warped.x),abs(warped.y)));
    vec3 signal = (uChannel < .5 && uReady > .5) ? texture2D(uVideo,uv).rgb : testSignal(uv);
    // Video inputs are sRGB; the output chunk expects linear light.
    signal = pow(max(signal,vec3(0.0)),vec3(2.2));
    float lineDensity = min(240.0, max(60.0,uScreenPixels*.45));
    float scan = 1.0 - .10 * uDetail * smoothstep(130.0,300.0,uScreenPixels) *
      (.5 + .5 * cos(vUv.y * lineDensity * 6.2831853));
    float vignette = 1.0 - .14 * dot(p,p);
    float tuning = fract(sin(dot(floor(uv*vec2(220.0,150.0)),vec2(12.9898,78.233))
      + floor(uTime*18.0)) * 43758.5453);
    signal = mix(signal,vec3(tuning*.16),uTune*.45);
    signal *= vec3(1.015,1.0,.94) * scan * vignette;
    float ignition = (1.0-opened) * .12;
    gl_FragColor = vec4(mix(glass,signal+ignition,imageMask*edge),1.0);
  }
  #include <colorspace_fragment>
}
`;

export class TVScreenMaterial extends THREE.ShaderMaterial {
  private lastRevision = -1;
  private lastSource: TVSource = 'off';
  private power = 0;
  private tune = 0;
  private time = 0;

  constructor(detail: boolean) {
    super({ vertexShader, fragmentShader, toneMapped: false, side: THREE.FrontSide,
      uniforms: { uVideo: { value: null }, uReady: { value: 0 }, uChannel: { value: 0 },
        uPower: { value: 0 }, uReader: { value: 0 }, uTune: { value: 0 }, uTime: { value: 0 },
        uDetail: { value: detail ? 1 : 0 }, uScreenPixels: { value: 0 } } });
    this.name = 'tv-local-crt-signal';
  }

  setVideo(texture: THREE.Texture | null, ready: boolean): void {
    this.uniforms.uVideo.value = texture;
    this.uniforms.uReady.value = ready ? 1 : 0;
  }

  update(source: TVSource, channel: number, revision: number, deltaMs: number, reduced: boolean, pixels: number,
    visible = true): void {
    const dt = visible ? phaseFrameDelta(deltaMs) : 0;
    if (revision !== this.lastRevision) {
      this.tune = this.lastRevision >= 0 && source === 'broadcast' && this.lastSource === source ? 1 : 0;
      this.lastRevision = revision;
    }
    if (source === 'projects') this.power = 0;
    else {
      const target = source === 'broadcast' ? 1 : 0;
      this.power = reduced ? target : THREE.MathUtils.clamp(this.power + (target ? 1 : -1) * dt / (target ? 640 : 360), 0, 1);
    }
    this.tune = reduced ? 0 : Math.max(0, this.tune - dt / 180);
    if (source === 'broadcast' && !reduced && (channel === 1 || this.tune > 0)) this.time = (this.time + dt / 1000) % 120;
    this.lastSource = source;
    this.uniforms.uPower.value = this.power;
    this.uniforms.uReader.value = source === 'projects' ? 1 : 0;
    this.uniforms.uChannel.value = channel;
    this.uniforms.uTune.value = this.tune;
    this.uniforms.uTime.value = this.time;
    this.uniforms.uScreenPixels.value = pixels;
  }
}
