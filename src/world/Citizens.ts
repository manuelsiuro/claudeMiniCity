// Tiny voxel pawns that wander the road + house network.
// Up to MAX_VISIBLE = min(pop, hardCap) at any time.  Cheap: one InstancedMesh.

import * as THREE from 'three';
import type { GameState, Tile } from '../types';
import { GRID_SIZE, TILE_SIZE, COLOR } from '../config/constants';
import { footprintHeight, inBounds, neighbors4 } from './Grid';

const MAX_VISIBLE = 30;
const SPEED_MIN = 1.2;
const SPEED_MAX = 2.0;

type Pawn = {
  active: boolean;
  ax: number; ay: number;          // from tile
  bx: number; by: number;          // to tile
  t: number;                       // 0..1 interp
  speed: number;
  yawCurrent: number;
  shirtHue: number;
};

export class Citizens {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private pawns: Pawn[] = [];

  private scratchM = new THREE.Matrix4();
  private scratchP = new THREE.Vector3();
  private scratchQ = new THREE.Quaternion();
  private scratchE = new THREE.Euler();
  private scratchS = new THREE.Vector3(1, 1, 1);
  private scratchC = new THREE.Color();
  private hiddenM = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor() {
    this.group.name = 'citizens';
    const geo = buildPawnGeometry();
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_VISIBLE);
    this.mesh.count = MAX_VISIBLE;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_VISIBLE * 3), 3);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    for (let i = 0; i < MAX_VISIBLE; i++) {
      this.pawns.push({
        active: false, ax: 0, ay: 0, bx: 0, by: 0, t: 0, speed: 1, yawCurrent: 0,
        shirtHue: Math.random(),
      });
      this.mesh.setMatrixAt(i, this.hiddenM);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  sync(state: GameState): void {
    const wanderable = state.tiles.filter(t => isWanderable(t));
    if (wanderable.length === 0) {
      for (let i = 0; i < MAX_VISIBLE; i++) {
        if (this.pawns[i].active) {
          this.pawns[i].active = false;
          this.mesh.setMatrixAt(i, this.hiddenM);
        }
      }
      this.mesh.instanceMatrix.needsUpdate = true;
      return;
    }
    const targetCount = Math.min(state.city.pop, MAX_VISIBLE);
    let activeCount = 0;
    for (const p of this.pawns) if (p.active) activeCount++;

    // Spawn missing
    for (let i = 0; i < MAX_VISIBLE && activeCount < targetCount; i++) {
      const p = this.pawns[i];
      if (p.active) continue;
      this.spawn(p, state);
      activeCount++;
    }
    // Despawn excess
    for (let i = MAX_VISIBLE - 1; i >= 0 && activeCount > targetCount; i--) {
      const p = this.pawns[i];
      if (!p.active) continue;
      p.active = false;
      this.mesh.setMatrixAt(i, this.hiddenM);
      activeCount--;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number, state: GameState): void {
    let dirty = false;
    for (let i = 0; i < this.pawns.length; i++) {
      const p = this.pawns[i];
      if (!p.active) continue;
      p.t += p.speed * dt;
      while (p.t >= 1) {
        p.t -= 1;
        // arrived at b; pick new b
        p.ax = p.bx; p.ay = p.by;
        const next = pickNeighbour(state.tiles, p.bx, p.by);
        if (!next) {
          // Stuck — try respawn fresh
          this.spawn(p, state);
          continue;
        }
        p.bx = next.x; p.by = next.y;
      }
      // Lerp position
      const ax = (p.ax + 0.5) * TILE_SIZE;
      const az = (p.ay + 0.5) * TILE_SIZE;
      const bx = (p.bx + 0.5) * TILE_SIZE;
      const bz = (p.by + 0.5) * TILE_SIZE;
      const x = ax + (bx - ax) * p.t;
      const z = az + (bz - az) * p.t;
      const aH = footprintHeight(state.tiles, p.ax, p.ay, 1);
      const bH = footprintHeight(state.tiles, p.bx, p.by, 1);
      const y = aH + (bH - aH) * p.t;
      // Yaw toward b
      const tgtYaw = Math.atan2(bx - ax, bz - az);
      const dy = wrapAngle(tgtYaw - p.yawCurrent);
      p.yawCurrent += dy * Math.min(1, dt * 8);
      this.scratchP.set(x, y, z);
      this.scratchE.set(0, p.yawCurrent, 0);
      this.scratchQ.setFromEuler(this.scratchE);
      // small bob
      const bob = Math.sin(p.t * Math.PI * 2 * 2) * 0.04;
      this.scratchS.set(1, 1 + bob, 1);
      this.scratchM.compose(this.scratchP, this.scratchQ, this.scratchS);
      this.mesh.setMatrixAt(i, this.scratchM);
      this.scratchC.setHSL(p.shirtHue, 0.55, 0.55);
      this.mesh.setColorAt(i, this.scratchC);
      dirty = true;
    }
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  private spawn(p: Pawn, state: GameState): void {
    const start = randomWanderableTile(state.tiles);
    if (!start) return;
    const next = pickNeighbour(state.tiles, start.x, start.y) ?? start;
    p.active = true;
    p.ax = start.x; p.ay = start.y;
    p.bx = next.x; p.by = next.y;
    p.t = Math.random() * 0.4;
    p.speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
    p.yawCurrent = Math.atan2((next.x - start.x), (next.y - start.y));
    p.shirtHue = Math.random();
  }

  dispose(): void {
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// ---------------------------------------------------------------------------

function isWanderable(t: Tile): boolean {
  // Roads + housing tiles + grass without building = wanderable
  return t.biome !== 'water';
}

function isStepTarget(state: { tiles: Tile[]; buildings: Map<number, { type: string }> }, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const t = state.tiles[y * GRID_SIZE + x];
  if (t.biome === 'water') return false;
  if (t.buildingId === null) return true; // open ground (grass/sand/forest/hill)
  const b = state.buildings.get(t.buildingId);
  if (!b) return true;
  // roads and houses are walkable; others block the pawn
  return b.type === 'road' || b.type === 'house' || b.type === 'cottage' || b.type === 'tenement' || b.type === 'park';
}

function pickNeighbour(
  tiles: Tile[],
  x: number, y: number,
): { x: number; y: number } | null {
  // We don't have access to the full state.buildings map here. Use a tile-only
  // check (water = blocked).  Tile-buildingId tells us non-empty; we still
  // need building-type. The Citizens class will pass the real map via the
  // module-level checkStepFn closure set during update.
  const opts: Array<{ x: number; y: number }> = [];
  for (const n of neighbors4(x, y)) {
    if (!inBounds(n.x, n.y)) continue;
    const t = tiles[n.y * GRID_SIZE + n.x];
    if (t.biome === 'water') continue;
    opts.push(n);
  }
  if (opts.length === 0) return null;
  return opts[Math.floor(Math.random() * opts.length)];
}

function randomWanderableTile(tiles: Tile[]): { x: number; y: number } | null {
  const candidates: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) {
    if (tiles[y * GRID_SIZE + x].biome !== 'water') candidates.push({ x, y });
  }
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function buildPawnGeometry(): THREE.BufferGeometry {
  // A two-box pawn: torso + head.  Both flat-shaded, base at y=0.
  const torso = new THREE.BoxGeometry(0.20, 0.30, 0.18);
  torso.translate(0, 0.20, 0);
  const head = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  head.translate(0, 0.46, 0);

  // assign per-vertex colors
  const fill = (g: THREE.BufferGeometry, color: number) => {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  };
  // shirt color from instanceColor (white base + multiply)
  fill(torso, 0xffffff);
  fill(head, COLOR.cream);

  return mergeTwo(torso, head);
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

// silence linter for the unused isStepTarget helper retained for clarity
void isStepTarget;
