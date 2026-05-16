// One InstancedMesh per BuildingType. Bounded draw calls regardless of city size.

import * as THREE from 'three';
import {
  BUILDING_TYPES,
  type BuildingType,
  type Tile,
} from '../types';
import { BUILDINGS, type VoxelPart } from '../config/buildings';
import { MAX_BUILDINGS_PER_TYPE, TILE_SIZE } from '../config/constants';
import { footprintHeight, footprintTilesAt } from './Grid';

function makeVoxelGeometry(parts: VoxelPart[]): THREE.BufferGeometry {
  // Manual merge so we don't pull in BufferGeometryUtils.
  let totalPosCount = 0;
  let totalIdxCount = 0;
  const subs: Array<{ pos: Float32Array; nrm: Float32Array; col: Float32Array; idx: Uint16Array }> = [];

  for (const part of parts) {
    const g = new THREE.BoxGeometry(part.w, part.h, part.d);
    g.translate(part.x, part.y, part.z);
    const c = new THREE.Color(part.color);
    const posCount = g.attributes.position.count;
    const col = new Float32Array(posCount * 3);
    for (let i = 0; i < posCount; i++) {
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const idx = g.index!.array as Uint16Array;
    subs.push({
      pos: g.attributes.position.array as Float32Array,
      nrm: g.attributes.normal.array as Float32Array,
      col,
      idx,
    });
    totalPosCount += posCount;
    totalIdxCount += idx.length;
    g.dispose();
  }

  const positions = new Float32Array(totalPosCount * 3);
  const normals = new Float32Array(totalPosCount * 3);
  const colors = new Float32Array(totalPosCount * 3);
  const indices = new Uint32Array(totalIdxCount);

  let posOff = 0, idxOff = 0, vOff = 0;
  for (const s of subs) {
    positions.set(s.pos, posOff);
    normals.set(s.nrm, posOff);
    colors.set(s.col, posOff);
    for (let i = 0; i < s.idx.length; i++) indices[idxOff + i] = s.idx[i] + vOff;
    posOff += s.pos.length;
    idxOff += s.idx.length;
    vOff += s.pos.length / 3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

class BuildingPool {
  mesh: THREE.InstancedMesh;
  private idToSlot = new Map<number, number>();
  private slotToId: number[] = [];
  private scratch = new THREE.Matrix4();
  private scratchP = new THREE.Vector3();
  private scratchQ = new THREE.Quaternion();
  private scratchS = new THREE.Vector3(1, 1, 1);

  constructor(type: BuildingType, capacity: number, material: THREE.Material) {
    const geo = makeVoxelGeometry(BUILDINGS[type].parts);
    this.mesh = new THREE.InstancedMesh(geo, material, capacity);
    this.mesh.name = `bld:${type}`;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false; // small world, simpler
  }

  add(id: number, x: number, y: number, footprint: number, baseY: number): void {
    if (this.idToSlot.has(id)) {
      this.update(id, x, y, footprint, baseY);
      return;
    }
    const slot = this.mesh.count;
    const center = footprintCenter(x, y, footprint);
    this.scratch.makeTranslation(center.cx, baseY, center.cz);
    this.mesh.setMatrixAt(slot, this.scratch);
    this.mesh.count = slot + 1;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.idToSlot.set(id, slot);
    this.slotToId[slot] = id;
  }

  update(id: number, x: number, y: number, footprint: number, baseY: number): void {
    const slot = this.idToSlot.get(id);
    if (slot === undefined) return;
    const center = footprintCenter(x, y, footprint);
    this.scratch.makeTranslation(center.cx, baseY, center.cz);
    this.mesh.setMatrixAt(slot, this.scratch);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  updateScale(id: number, x: number, y: number, footprint: number, baseY: number, scale: number): void {
    const slot = this.idToSlot.get(id);
    if (slot === undefined) return;
    const center = footprintCenter(x, y, footprint);
    this.scratchP.set(center.cx, baseY, center.cz);
    this.scratchS.set(1, scale, 1);
    this.scratchQ.identity();
    this.scratch.compose(this.scratchP, this.scratchQ, this.scratchS);
    this.mesh.setMatrixAt(slot, this.scratch);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  remove(id: number): void {
    const slot = this.idToSlot.get(id);
    if (slot === undefined) return;
    const last = this.mesh.count - 1;
    if (slot !== last) {
      this.mesh.getMatrixAt(last, this.scratch);
      this.mesh.setMatrixAt(slot, this.scratch);
      const lastId = this.slotToId[last];
      this.idToSlot.set(lastId, slot);
      this.slotToId[slot] = lastId;
    }
    this.idToSlot.delete(id);
    this.slotToId.pop();
    this.mesh.count = last;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.idToSlot.clear();
    this.slotToId.length = 0;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function footprintCenter(x: number, y: number, footprint: number): { cx: number; cz: number } {
  return {
    cx: (x + footprint / 2) * TILE_SIZE,
    cz: (y + footprint / 2) * TILE_SIZE,
  };
}

export class InstancedBuildings {
  private pools = new Map<BuildingType, BuildingPool>();
  group = new THREE.Group();
  private material: THREE.MeshLambertMaterial;

  constructor() {
    this.group.name = 'buildings';
    this.material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    });
    for (const t of BUILDING_TYPES) {
      const pool = new BuildingPool(t, MAX_BUILDINGS_PER_TYPE, this.material);
      this.pools.set(t, pool);
      this.group.add(pool.mesh);
    }
  }

  add(building: { id: number; type: BuildingType; x: number; y: number }, tiles: Tile[]): void {
    const def = BUILDINGS[building.type];
    const h = footprintHeight(tiles, building.x, building.y, def.footprint);
    this.pools.get(building.type)!.add(building.id, building.x, building.y, def.footprint, h);
  }

  remove(id: number, type: BuildingType): void {
    this.pools.get(type)!.remove(id);
  }

  updateScale(id: number, type: BuildingType, x: number, y: number, footprint: number, baseY: number, scale: number): void {
    this.pools.get(type)!.updateScale(id, x, y, footprint, baseY, scale);
  }

  clearAll(): void {
    for (const p of this.pools.values()) p.clear();
  }

  // Returns world coords of the footprint center for visual cursors etc.
  static footprintCenter(x: number, y: number, footprint: number) {
    return footprintCenter(x, y, footprint);
  }

  // Useful helper for the placement-validity overlay later.
  countAt(x: number, y: number, footprint: number): { x: number; y: number }[] {
    return footprintTilesAt(x, y, footprint);
  }

  dispose(): void {
    for (const p of this.pools.values()) {
      (p.mesh.geometry as THREE.BufferGeometry).dispose();
      p.mesh.dispose();
    }
    this.material.dispose();
  }
}
