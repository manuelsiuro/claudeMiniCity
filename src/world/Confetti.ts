// One-shot confetti burst for milestones and the wonder-complete event.
// Pool of colourful cubes with gravity + per-particle spin + colour.

import * as THREE from 'three';

const POOL = 140;
const PARTICLES_PER_BURST = 80;
const LIFETIME = 2.8;

type Particle = {
  alive: boolean;
  age: number;
  vx: number; vy: number; vz: number;
  ox: number; oy: number; oz: number;
  spin: number;
  color: THREE.Color;
};

const PALETTE = [
  0xff6f9c, 0xffe066, 0x74d36f, 0x5eb6ff, 0xc98ce0, 0xff9f43, 0x33d6c1,
];

export class Confetti {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private scratchM = new THREE.Matrix4();
  private scratchP = new THREE.Vector3();
  private scratchQ = new THREE.Quaternion();
  private scratchE = new THREE.Euler();
  private scratchS = new THREE.Vector3();
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor() {
    this.group.name = 'confetti';
    const geo = new THREE.BoxGeometry(0.14, 0.05, 0.10);
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: false,
      transparent: true,
      opacity: 1.0,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, POOL);
    this.mesh.count = POOL;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 3), 3);
    this.group.add(this.mesh);
    for (let i = 0; i < POOL; i++) {
      this.particles.push({
        alive: false, age: 0,
        vx: 0, vy: 0, vz: 0, ox: 0, oy: 0, oz: 0,
        spin: 0,
        color: new THREE.Color(0xffffff),
      });
      this.mesh.setMatrixAt(i, this.hidden);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  burst(wx: number, wy: number, wz: number): void {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < PARTICLES_PER_BURST; i++) {
      const p = this.particles[i];
      if (p.alive) continue;
      p.alive = true;
      p.age = 0;
      p.ox = wx;
      p.oy = wy + 0.5;
      p.oz = wz;
      const ang = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 3.0;
      p.vx = Math.cos(ang) * speed * 0.6;
      p.vz = Math.sin(ang) * speed * 0.6;
      p.vy = 5.0 + Math.random() * 4.0;
      p.spin = (Math.random() - 0.5) * 12;
      p.color.setHex(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
      spawned++;
    }
  }

  update(dt: number): void {
    const g = 9.0;
    let dirty = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= LIFETIME) {
        p.alive = false;
        this.mesh.setMatrixAt(i, this.hidden);
        dirty = true;
        continue;
      }
      const t = p.age;
      const u = t / LIFETIME;
      const x = p.ox + p.vx * t;
      const z = p.oz + p.vz * t;
      const y = p.oy + p.vy * t - 0.5 * g * t * t;
      this.scratchP.set(x, Math.max(p.oy - 0.4, y), z);
      this.scratchE.set(t * p.spin, t * p.spin * 0.7, t * p.spin * 1.3);
      this.scratchQ.setFromEuler(this.scratchE);
      const scale = 1 - u * 0.4;
      this.scratchS.set(scale, scale, scale);
      this.scratchM.compose(this.scratchP, this.scratchQ, this.scratchS);
      this.mesh.setMatrixAt(i, this.scratchM);
      this.mesh.setColorAt(i, p.color);
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
