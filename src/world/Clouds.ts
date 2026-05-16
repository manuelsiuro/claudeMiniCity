// Voxel clouds drifting across the sky.
// Each cloud is a small cluster of cubes merged into one geometry.
// One InstancedMesh of N clouds; per-frame matrix update.

import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from '../config/constants';

const COUNT = 8;
const SPEED_MIN = 0.4;
const SPEED_MAX = 1.0;
const ALT_MIN = 12;
const ALT_MAX = 18;

type Cloud = {
  x: number; y: number; z: number;
  vx: number; vz: number;
  scale: number;
};

export class Clouds {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private clouds: Cloud[] = [];
  private scratchM = new THREE.Matrix4();
  private scratchP = new THREE.Vector3();
  private scratchQ = new THREE.Quaternion();
  private scratchS = new THREE.Vector3();

  constructor() {
    this.group.name = 'clouds';
    const geo = buildCloudGeom();
    const mat = new THREE.MeshLambertMaterial({
      color: 0xfdfeff,
      transparent: true,
      opacity: 0.88,
      flatShading: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    this.mesh.count = COUNT;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    for (let i = 0; i < COUNT; i++) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.clouds.push({
        x: GRID_SIZE * Math.random(),
        y: ALT_MIN + Math.random() * (ALT_MAX - ALT_MIN),
        z: GRID_SIZE * Math.random(),
        vx: dir * (SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)),
        vz: (Math.random() - 0.5) * 0.2,
        scale: 0.8 + Math.random() * 0.8,
      });
    }
  }

  update(dt: number): void {
    const pad = 6;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      if (c.x < -pad)       c.x = GRID_SIZE + pad;
      if (c.x > GRID_SIZE + pad) c.x = -pad;
      if (c.z < -pad)       c.z = GRID_SIZE + pad;
      if (c.z > GRID_SIZE + pad) c.z = -pad;
      this.scratchP.set(c.x * TILE_SIZE, c.y, c.z * TILE_SIZE);
      this.scratchQ.identity();
      this.scratchS.setScalar(c.scale);
      this.scratchM.compose(this.scratchP, this.scratchQ, this.scratchS);
      this.mesh.setMatrixAt(i, this.scratchM);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

function buildCloudGeom(): THREE.BufferGeometry {
  // 5 overlapping boxes shaped like a cumulus puff.
  const parts: Array<{ g: THREE.BufferGeometry; tint: number }> = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, tint: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    parts.push({ g, tint });
  };
  box(   0,    0.3, 0,   1.6, 0.55, 1.0, 1.0);
  box(-0.6, 0.45, 0.1, 0.9, 0.55, 0.9, 0.92);
  box( 0.55, 0.45, 0.0, 0.9, 0.50, 0.9, 0.95);
  box( 0.1,  0.78, 0.0, 0.8, 0.40, 0.8, 1.0);
  box(-0.2, 0.18, 0.4, 0.7, 0.30, 0.55, 0.85);

  // Apply per-box tint as vertex colour.
  for (const p of parts) {
    const n = p.g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = p.tint;
      arr[i * 3 + 1] = p.tint;
      arr[i * 3 + 2] = p.tint;
    }
    p.g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  }
  let merged = parts[0].g;
  for (let i = 1; i < parts.length; i++) merged = mergeTwo(merged, parts[i].g);
  return merged;
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const pa = a.attributes.position as THREE.BufferAttribute;
  const na = a.attributes.normal as THREE.BufferAttribute;
  const ca = a.attributes.color as THREE.BufferAttribute;
  const pb = b.attributes.position as THREE.BufferAttribute;
  const nb = b.attributes.normal as THREE.BufferAttribute;
  const cb = b.attributes.color as THREE.BufferAttribute;
  const ia = a.index!;
  const ib = b.index!;
  const positions = new Float32Array(pa.count * 3 + pb.count * 3);
  positions.set(pa.array as Float32Array, 0);
  positions.set(pb.array as Float32Array, pa.count * 3);
  const normals = new Float32Array(na.count * 3 + nb.count * 3);
  normals.set(na.array as Float32Array, 0);
  normals.set(nb.array as Float32Array, na.count * 3);
  const colors = new Float32Array(ca.count * 3 + cb.count * 3);
  colors.set(ca.array as Float32Array, 0);
  colors.set(cb.array as Float32Array, ca.count * 3);
  const index = new Uint32Array(ia.count + ib.count);
  for (let i = 0; i < ia.count; i++) index[i] = ia.getX(i);
  for (let i = 0; i < ib.count; i++) index[ia.count + i] = ib.getX(i) + pa.count;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}
