// Waving cloth flags overlaid on top of buildings with banners.
// One ShaderMaterial drives vertex displacement; each instance carries its
// own phase + colour so the cloths don't all wave in unison.

import * as THREE from 'three';
import type { GameState, BuildingType, Building, Tile } from '../types';
import { BUILDINGS } from '../config/buildings';
import { TILE_SIZE, COLOR } from '../config/constants';
import { footprintHeight } from './Grid';

// Per-type flag offset in tile-local space + colour.  Geometry is a plane
// extending in +X (cloth waves along X away from the pole at X=0).
const FLAGS: Partial<Record<BuildingType, { x: number; y: number; z: number; color: number; w: number; h: number }>> = {
  watchtower:  { x: 0, y: 1.68, z:  0,    color: COLOR.red,    w: 0.22, h: 0.16 },
  stadium:     { x: 0, y: 1.22, z: -0.85, color: COLOR.red,    w: 0.22, h: 0.18 },
  market:      { x: 0, y: 1.40, z: -0.75, color: COLOR.yellow, w: 0.22, h: 0.16 },
  school:      { x: 0, y: 1.45, z:  0,    color: COLOR.red,    w: 0.20, h: 0.12 },
  fireStation: { x: 0, y: 1.46, z:  0,    color: COLOR.white,  w: 0.20, h: 0.14 },
  wonder:      { x: 0, y: 2.85, z:  0,    color: COLOR.gold,   w: 0.30, h: 0.20 },
};

const MAX_FLAGS = 64;
const BASE_W = 0.30;
const BASE_H = 0.18;

const vertexShader = /* glsl */`
  uniform float uTime;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vec3 p = position;
    float k = clamp((p.x + 0.05) / 0.30, 0.0, 1.0);
    float w = sin(uTime * 3.0 + aPhase + p.x * 8.0) * 0.05;
    p.z += w * k;
    p.y += sin(uTime * 2.0 + aPhase) * 0.005;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

export class Flags {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;
  private phase: THREE.InstancedBufferAttribute;
  private color: THREE.InstancedBufferAttribute;

  private scratchM = new THREE.Matrix4();
  private scratchP = new THREE.Vector3();
  private scratchQ = new THREE.Quaternion();
  private scratchE = new THREE.Euler();
  private scratchS = new THREE.Vector3(1, 1, 1);
  private tmpColor = new THREE.Color();

  constructor() {
    this.group.name = 'flags';

    const geo = new THREE.PlaneGeometry(BASE_W, BASE_H, 6, 1);
    geo.translate(BASE_W / 2, 0, 0); // pivot at left edge (near pole)

    this.phase = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLAGS), 1);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLAGS * 3), 3);
    geo.setAttribute('aPhase', this.phase);
    geo.setAttribute('aColor', this.color);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX_FLAGS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  sync(state: GameState): void {
    let count = 0;
    for (const b of state.buildings.values()) {
      const flag = FLAGS[b.type as BuildingType];
      if (!flag) continue;
      this.applyMatrix(b, flag, count, state.tiles);
      this.applyColor(count, flag.color);
      this.phase.array[count] = (b.id * 1.07) % (Math.PI * 2);
      count++;
      if (count >= MAX_FLAGS) break;
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.phase.needsUpdate = true;
    this.color.needsUpdate = true;
  }

  update(dt: number): void {
    this.material.uniforms.uTime.value += dt;
  }

  private applyMatrix(
    b: Building,
    flag: NonNullable<typeof FLAGS[BuildingType]>,
    slot: number,
    tiles: Tile[],
  ): void {
    const fp = BUILDINGS[b.type].footprint;
    const cx = (b.x + fp / 2) * TILE_SIZE + flag.x;
    const cz = (b.y + fp / 2) * TILE_SIZE + flag.z;
    const baseY = footprintHeight(tiles, b.x, b.y, fp);
    this.scratchP.set(cx, baseY + flag.y, cz);
    this.scratchE.set(0, 0, 0);
    this.scratchQ.setFromEuler(this.scratchE);
    this.scratchS.set(flag.w / BASE_W, flag.h / BASE_H, 1);
    this.scratchM.compose(this.scratchP, this.scratchQ, this.scratchS);
    this.mesh.setMatrixAt(slot, this.scratchM);
  }

  private applyColor(slot: number, hex: number): void {
    const c = this.tmpColor.setHex(hex);
    this.color.array[slot * 3] = c.r;
    this.color.array[slot * 3 + 1] = c.g;
    this.color.array[slot * 3 + 2] = c.b;
  }

  dispose(): void {
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    this.material.dispose();
  }
}
