// Ambient voxel birds drifting on lazy circular paths above the map.
// 10 birds, one InstancedMesh, per-frame matrix update.

import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from '../config/constants';

const COUNT = 10;

type Bird = {
  cx: number; cz: number;       // orbit centre
  radius: number;
  altitude: number;
  speed: number;                // radians/sec
  phase: number;                // start angle
  flapPhase: number;
};

export class Birds {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private birds: Bird[] = [];
  private scratchM = new THREE.Matrix4();
  private scratchP = new THREE.Vector3();
  private scratchQ = new THREE.Quaternion();
  private scratchE = new THREE.Euler();
  private scratchS = new THREE.Vector3();
  private time = 0;

  constructor() {
    this.group.name = 'birds';
    const geo = buildBirdGeom();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    this.mesh.count = COUNT;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    for (let i = 0; i < COUNT; i++) {
      const cx = GRID_SIZE * (0.25 + Math.random() * 0.5);
      const cz = GRID_SIZE * (0.25 + Math.random() * 0.5);
      this.birds.push({
        cx, cz,
        radius: 3 + Math.random() * 6,
        altitude: 5 + Math.random() * 4,
        speed: (0.18 + Math.random() * 0.3) * (Math.random() < 0.5 ? 1 : -1),
        phase: Math.random() * Math.PI * 2,
        flapPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      const angle = b.phase + this.time * b.speed;
      const x = b.cx + Math.cos(angle) * b.radius;
      const z = b.cz + Math.sin(angle) * b.radius;
      const y = b.altitude + Math.sin(this.time * 0.5 + b.phase) * 0.4;
      this.scratchP.set(x * TILE_SIZE, y, z * TILE_SIZE);
      // Face direction of travel.
      const yaw = angle + (b.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.scratchE.set(0, yaw, 0);
      this.scratchQ.setFromEuler(this.scratchE);
      // Wing flap via subtle Y-scale oscillation on the whole mesh.
      const flap = 1 + Math.sin(this.time * 8 + b.flapPhase) * 0.18;
      this.scratchS.set(1, flap, 1);
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

function buildBirdGeom(): THREE.BufferGeometry {
  // Two wings spread along X, tiny body in the middle.
  const wing = new THREE.BoxGeometry(0.36, 0.03, 0.10);
  const body = new THREE.BoxGeometry(0.10, 0.06, 0.10);
  const fill = (g: THREE.BufferGeometry, color: number) => {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  };
  fill(wing, 0x202020);
  fill(body, 0x3a2a1c);

  return mergeTwo(wing, body);
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
