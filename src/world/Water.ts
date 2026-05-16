// Stylized cartoon water — faithful port of thaslle/stylized-water.
// Plain light-blue surface, gentle uniform bobbing, fine simplex-noise
// foam sparkle, radial gradient toward the far color near the edges.

import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from '../config/constants';

const WATER_LEVEL = -0.05;
const SUBDIVISIONS = 8;

const vertexShader = /* glsl */`
  uniform float uTime;
  uniform float uWaveSpeed;
  uniform float uWaveAmplitude;
  varying vec2 vUv;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * uWaveSpeed) * uWaveAmplitude;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform float uTime;
  uniform vec3  uColorNear;
  uniform vec3  uColorFar;
  uniform vec3  uFoam;
  uniform float uTextureSize;
  varying vec2 vUv;

  // Simplex noise — Ashima Arts, MIT (https://github.com/ashima/webgl-noise)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    float textureSize = 100.0 - uTextureSize;

    // Foam: small high-frequency sparkle dots.
    float nFoam = snoise(vUv * (textureSize * 2.8) + sin(uTime * 0.3)) * 0.5 + 0.5;
    float foam = step(0.5, smoothstep(0.08, 0.001, nFoam));

    // Wave streaks: larger-scale thresholded noise → big curving white lines.
    float nWave = snoise(vUv * textureSize + sin(uTime * -0.1)) * 0.5 + 0.5;
    float thr = 0.6 + 0.01 * sin(uTime * 2.0);
    float waves = 1.0 - (smoothstep(thr + 0.03, thr + 0.032, nWave)
                       + smoothstep(thr, thr - 0.01, nWave));
    waves = step(0.5, waves);

    float caps = min(foam + waves, 1.0);

    // Radial gradient toward the far color near the edges (the reference's vignette).
    float vignette = length(vUv - 0.5) * 1.5;
    float edge = smoothstep(0.1, 0.3, vignette);
    vec3 base = mix(uColorNear, uColorFar, edge);

    vec3 col = mix(base, uFoam, caps);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Water {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.PlaneGeometry(
      GRID_SIZE * TILE_SIZE,
      GRID_SIZE * TILE_SIZE,
      SUBDIVISIONS,
      SUBDIVISIONS,
    );
    geo.rotateX(-Math.PI / 2);
    geo.translate(GRID_SIZE * TILE_SIZE / 2, WATER_LEVEL, GRID_SIZE * TILE_SIZE / 2);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:          { value: 0 },
        uWaveSpeed:     { value: 1.2 },
        uWaveAmplitude: { value: 0.025 },
        uTextureSize:   { value: 70 },
        uColorNear:     { value: new THREE.Color(0xa8dcef) },
        uColorFar:      { value: new THREE.Color(0x76c3e0) },
        uFoam:          { value: new THREE.Color(0xeaf3ff) },
      },
      vertexShader,
      fragmentShader,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'water';
    this.mesh.renderOrder = 1;
  }

  update(dt: number): void {
    this.material.uniforms.uTime.value += dt;
  }

  dispose(): void {
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    this.material.dispose();
  }
}
