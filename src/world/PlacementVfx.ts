// Short-lived particle puffs for building placement / demolish.
// Pool of N small cubes that fly outward and fade.

import * as THREE from 'three';
import { TILE_SIZE } from '../config/constants';

const POOL_SIZE = 80;
const PARTICLES_PER_PUFF = 14;
const PARTICLE_LIFETIME = 0.55;
const PARTICLE_SIZE = 0.12;

type Particle = {
  alive: boolean;
  age: number;
  vx: number; vy: number; vz: number;
  ox: number; oy: number; oz: number;
  color: THREE.Color;
};

export class PlacementVfx {
  private root = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private scratchM = new THREE.Matrix4();
  private scratchP = new THREE.Vector3();
  private scratchS = new THREE.Vector3();
  private scratchQ = new THREE.Quaternion();
  private scratchC = new THREE.Color();

  constructor(parent: THREE.Object3D) {
    this.root.name = 'placementVfx';
    parent.add(this.root);

    const geo = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: false,
      transparent: true,
      opacity: 1.0,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, POOL_SIZE);
    this.mesh.count = POOL_SIZE;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(POOL_SIZE * 3), 3);
    this.root.add(this.mesh);

    // initialise hidden
    this.scratchM.makeScale(0, 0, 0);
    for (let i = 0; i < POOL_SIZE; i++) {
      this.mesh.setMatrixAt(i, this.scratchM);
      this.particles.push({
        alive: false, age: 0,
        vx: 0, vy: 0, vz: 0, ox: 0, oy: 0, oz: 0,
        color: new THREE.Color(0xffffff),
      });
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Emit a puff at world position with a tint colour. */
  emit(wx: number, wy: number, wz: number, color: number, footprint = 1): void {
    let spawned = 0;
    const spread = 0.25 + footprint * 0.10;
    for (let i = 0; i < this.particles.length && spawned < PARTICLES_PER_PUFF; i++) {
      const p = this.particles[i];
      if (p.alive) continue;
      p.alive = true;
      p.age = 0;
      p.ox = wx + (Math.random() - 0.5) * spread * TILE_SIZE;
      p.oy = wy + 0.04;
      p.oz = wz + (Math.random() - 0.5) * spread * TILE_SIZE;
      const ang = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 0.9;
      p.vx = Math.cos(ang) * speed;
      p.vz = Math.sin(ang) * speed;
      p.vy = 1.2 + Math.random() * 1.4;
      p.color.setHex(color);
      // mild tint variation
      const j = (Math.random() - 0.5) * 0.15;
      p.color.r = Math.min(1, Math.max(0, p.color.r + j));
      p.color.g = Math.min(1, Math.max(0, p.color.g + j));
      p.color.b = Math.min(1, Math.max(0, p.color.b + j));
      spawned++;
    }
  }

  update(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= PARTICLE_LIFETIME) {
        p.alive = false;
        this.scratchM.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.scratchM);
        dirty = true;
        continue;
      }
      const t = p.age;
      const u = t / PARTICLE_LIFETIME;
      // Position from initial velocity and constant gravity.
      const g = 4.0;
      const x = p.ox + p.vx * t;
      const z = p.oz + p.vz * t;
      const y = p.oy + p.vy * t - 0.5 * g * t * t;
      this.scratchP.set(x, Math.max(p.oy - 0.05, y), z);
      const scale = 1.0 - u * 0.6;
      this.scratchS.set(scale, scale, scale);
      this.scratchQ.identity();
      this.scratchM.compose(this.scratchP, this.scratchQ, this.scratchS);
      this.mesh.setMatrixAt(i, this.scratchM);
      // colour: fade by darkening
      this.scratchC.copy(p.color).multiplyScalar(1.0 - u * 0.35);
      this.mesh.setColorAt(i, this.scratchC);
      dirty = true;
    }
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
