// Animated white/grey smoke puffs above active producers + residences.
// Cheap: one InstancedMesh of small box puffs; pawn-style update.

import * as THREE from 'three';
import type { GameState, Building, BuildingType } from '../types';
import { BUILDINGS } from '../config/buildings';
import { TILE_SIZE } from '../config/constants';
import { footprintHeight } from './Grid';

type PuffSlot = {
  buildingId: number;
  t: number;        // 0..1 lifetime
  age: number;      // raw seconds, used for jitter
};

// Per-type chimney offset (x, y above base, z) in tile-local space.
const CHIMNEY_OFFSET: Partial<Record<BuildingType, { x: number; y: number; z: number; rate: number }>> = {
  house:    { x: -0.25, y: 1.10, z:  0.25, rate: 0.5 },
  cottage:  { x:  0.30, y: 1.10, z: -0.25, rate: 0.55 },
  bakery:   { x:  0.28, y: 1.55, z: -0.28, rate: 1.4 },
  workshop: { x:  0.30, y: 1.65, z: -0.30, rate: 1.6 },
  forester: { x:  0.0,  y: 0.95, z:  0.0,  rate: 0.4 },
  fireStation: { x: 0.0, y: 1.10, z: 0.0, rate: 0.45 },
};

const MAX_PUFFS = 80;
const PUFF_LIFETIME = 2.4;

export class ChimneyVfx {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private slots: PuffSlot[] = [];
  private spawnAcc = new Map<number, number>();

  private scratchM = new THREE.Matrix4();
  private scratchP = new THREE.Vector3();
  private scratchQ = new THREE.Quaternion();
  private scratchS = new THREE.Vector3(1, 1, 1);
  private scratchC = new THREE.Color();
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor() {
    this.group.name = 'chimneyVfx';
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: false,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PUFFS);
    this.mesh.count = MAX_PUFFS;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PUFFS * 3), 3);
    this.group.add(this.mesh);

    for (let i = 0; i < MAX_PUFFS; i++) {
      this.slots.push({ buildingId: -1, t: 0, age: 0 });
      this.mesh.setMatrixAt(i, this.hidden);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number, state: GameState): void {
    // 1) Age + render existing puffs.
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.buildingId < 0) continue;
      s.age += dt;
      s.t += dt / PUFF_LIFETIME;
      if (s.t >= 1) {
        s.buildingId = -1;
        this.mesh.setMatrixAt(i, this.hidden);
        continue;
      }
      const b = state.buildings.get(s.buildingId);
      if (!b) {
        s.buildingId = -1;
        this.mesh.setMatrixAt(i, this.hidden);
        continue;
      }
      const off = CHIMNEY_OFFSET[b.type as BuildingType];
      if (!off) {
        s.buildingId = -1;
        this.mesh.setMatrixAt(i, this.hidden);
        continue;
      }
      const baseY = footprintHeight(state.tiles, b.x, b.y, BUILDINGS[b.type].footprint);
      const cx = (b.x + BUILDINGS[b.type].footprint / 2) * TILE_SIZE + off.x;
      const cz = (b.y + BUILDINGS[b.type].footprint / 2) * TILE_SIZE + off.z;
      const rise = s.t * 1.1;
      const drift = Math.sin(s.age * 1.5) * 0.04;
      this.scratchP.set(cx + drift, baseY + off.y + rise, cz + drift * 0.5);
      const sz = 0.5 + s.t * 0.9;
      this.scratchS.setScalar(sz);
      this.scratchQ.setFromAxisAngle(_Y, s.age * 0.8);
      this.scratchM.compose(this.scratchP, this.scratchQ, this.scratchS);
      this.mesh.setMatrixAt(i, this.scratchM);
      const fade = 1 - s.t;
      const tint = 0.5 + 0.25 * fade;
      this.scratchC.setRGB(tint, tint, tint);
      this.mesh.setColorAt(i, this.scratchC);
    }

    // 2) Spawn new puffs for active producers / residences.
    for (const b of state.buildings.values()) {
      const off = CHIMNEY_OFFSET[b.type as BuildingType];
      if (!off) continue;
      if (b.burning !== undefined) continue; // fire smoke handled by FireVfx
      // For producers, smoke only when not idle.
      const def = BUILDINGS[b.type];
      if (def.produces && b.idle) continue;
      let acc = this.spawnAcc.get(b.id) ?? Math.random();
      acc += dt * off.rate;
      while (acc > 1) {
        acc -= 1;
        this.allocate(b);
      }
      this.spawnAcc.set(b.id, acc);
    }

    // 3) Cleanup spawn accumulators for buildings that vanished.
    for (const id of [...this.spawnAcc.keys()]) {
      if (!state.buildings.has(id)) this.spawnAcc.delete(id);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private allocate(b: Building): void {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].buildingId < 0) {
        this.slots[i].buildingId = b.id;
        this.slots[i].t = 0;
        this.slots[i].age = Math.random() * Math.PI * 2;
        return;
      }
    }
    // pool full — drop puff
  }

  dispose(): void {
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

const _Y = new THREE.Vector3(0, 1, 0);
