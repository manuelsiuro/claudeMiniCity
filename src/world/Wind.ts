// Faint white gradient ribbons that drift across the map at low altitude.
// Each ribbon is a 20-segment plane whose vertices are rewritten every
// frame to trace a curving path driven by simplex noise.
// Ported from dammafra/drysland src/experience/grid/wind.js.

import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { GRID_SIZE, TILE_SIZE } from '../config/constants';

const simplex = new SimplexNoise();
const COUNT = 4;
const SEGMENTS = 20;
const SPEED = 0.6;

type Streak = {
  mesh: THREE.Mesh;
  pos: THREE.BufferAttribute;
  rnda: number;
  rndb: number;
  rndc: number;
  rndd: number;
};

let sharedTexture: THREE.CanvasTexture | null = null;
function getTexture(): THREE.CanvasTexture {
  if (sharedTexture) return sharedTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 8);
  sharedTexture = new THREE.CanvasTexture(canvas);
  return sharedTexture;
}

export class Wind {
  readonly group = new THREE.Group();
  private streaks: Streak[] = [];
  private material: THREE.MeshBasicMaterial;
  private geometries: THREE.PlaneGeometry[] = [];

  constructor() {
    this.group.name = 'wind';
    this.material = new THREE.MeshBasicMaterial({
      map: getTexture(),
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    });

    for (let i = 0; i < COUNT; i++) {
      const geo = new THREE.PlaneGeometry(1, 1, SEGMENTS, 1);
      this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.frustumCulled = false;
      mesh.position.set((GRID_SIZE / 2) * TILE_SIZE, 0, (GRID_SIZE / 2) * TILE_SIZE);
      this.group.add(mesh);

      this.streaks.push({
        mesh,
        pos: geo.getAttribute('position') as THREE.BufferAttribute,
        rnda: Math.random(),
        rndb: Math.random(),
        rndc: Math.random(),
        rndd: Math.random(),
      });
    }
  }

  // Sample a height field over the map. Out-of-bounds samples return -1
  // so the corresponding vertices sink below the terrain and the streak
  // visually fades off the island.
  private getElevation(x: number, y: number): number {
    const half = GRID_SIZE * 0.5 - 0.5;
    if (x * x > half * half || y * y > half * half) return -1;
    const major = 0.6 * simplex.noise(0.1 * x, 0.1 * y);
    const minor = 0.2 * simplex.noise(0.3 * x, 0.3 * y);
    return major + minor;
  }

  update(_dt: number, elapsed: number): void {
    const t = elapsed * SPEED;
    const half = GRID_SIZE * 0.5;
    for (const s of this.streaks) {
      // The plane has 2*(SEGMENTS+1) vertices: 21 across the top row + 21 across the bottom.
      // Drysland rewrites them all in one tight loop, sampling a noisy circular path.
      for (let i = 0; i < (SEGMENTS + 1) * 2; i++) {
        const phase = i % (SEGMENTS + 1);
        const x = half * 0.7 * Math.sin(5 * s.rnda * t + 6 * s.rndb + phase * 0.05);
        const y = half * 0.7 * Math.cos(5 * s.rndc * t + 6 * s.rndd + phase * 0.05);
        const z = this.getElevation(x, y) + 0.6 + 0.04 * (i > SEGMENTS ? 1 : -1)
          * Math.cos((phase - SEGMENTS * 0.5) / 8);
        s.pos.setXYZ(i, x, z, -y);
      }
      s.pos.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.material.dispose();
    if (sharedTexture) {
      sharedTexture.dispose();
      sharedTexture = null;
    }
  }
}
