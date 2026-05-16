// Builds a single merged BufferGeometry for the terrain. One draw call.
// Each tile contributes a top quad + side quads where neighbor is lower.

import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE, COLOR } from '../config/constants';
import type { Tile, Biome } from '../types';

const WATER_LEVEL = -0.1;

// Topsoil colour shown on the top face of a tile.
function biomeColor(b: Biome): THREE.Color {
  switch (b) {
    case 'grass': return new THREE.Color(COLOR.grass);
    case 'hill': return new THREE.Color(COLOR.hillTop);
    case 'forest': return new THREE.Color(COLOR.forest);
    case 'sand': return new THREE.Color(COLOR.sand);
    case 'water': return new THREE.Color(0x9bd6f0);
  }
}

// Thin band of topsoil at the very top of the side wall — same hue
// as the top face so the transition reads as "grass crust over dirt".
function topsoilSideColor(b: Biome): THREE.Color {
  switch (b) {
    case 'grass': return new THREE.Color(COLOR.grassDark);
    case 'hill': return new THREE.Color(COLOR.hill);
    case 'forest': return new THREE.Color(COLOR.forestCanopy);
    case 'sand': return new THREE.Color(COLOR.sand);
    case 'water': return new THREE.Color(0x9bd6f0);
  }
}

// Substrate that fills the bulk of any cliff face.
// Grass / forest → dirt, hill → rock, sand → sand, water → deep water.
function substrateColor(b: Biome): THREE.Color {
  switch (b) {
    case 'grass': return new THREE.Color(COLOR.dirt);
    case 'forest': return new THREE.Color(COLOR.dirtDark);
    case 'hill': return new THREE.Color(COLOR.rock);
    case 'sand': return new THREE.Color(COLOR.sand).multiplyScalar(0.78);
    case 'water': return new THREE.Color(0x9bd6f0);
  }
}

export type TerrainMeshes = {
  ground: THREE.Mesh;
  decor: THREE.Group;
};

export function buildTerrainMeshes(tiles: Tile[]): TerrainMeshes {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tile = (x: number, y: number): Tile => tiles[y * GRID_SIZE + x];

  let idxBase = 0;
  const pushQuad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    n: [number, number, number],
    col: THREE.Color,
  ): void => {
    positions.push(...a, ...b, ...c, ...d);
    normals.push(...n, ...n, ...n, ...n);
    colors.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
    indices.push(idxBase, idxBase + 1, idxBase + 2, idxBase, idxBase + 2, idxBase + 3);
    idxBase += 4;
  };

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const t = tile(x, y);
      const h = t.biome === 'water' ? WATER_LEVEL - 0.05 : t.height;
      const x0 = x * TILE_SIZE;
      const x1 = (x + 1) * TILE_SIZE;
      const z0 = y * TILE_SIZE;
      const z1 = (y + 1) * TILE_SIZE;

      const topCol = biomeColor(t.biome);
      // top quad (CCW from above for upward normal)
      pushQuad(
        [x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0],
        [0, 1, 0], topCol,
      );

      // side walls where neighbor is lower (or out of bounds).
      // Each wall is split into a thin "topsoil" band at the top (same hue as
      // the top face, ~3cm in world units) and a thicker "substrate" band
      // below — dirt for grass/forest, rock for hill, sand for sand.
      const topCrust = topsoilSideColor(t.biome);
      const subCol = substrateColor(t.biome);
      const TOPSOIL_THICKNESS = 0.08;
      const neighbors: Array<[number, number, [number, number, number]]> = [
        [x + 1, y, [1, 0, 0]],
        [x - 1, y, [-1, 0, 0]],
        [x, y + 1, [0, 0, 1]],
        [x, y - 1, [0, 0, -1]],
      ];
      for (const [nx, ny, n] of neighbors) {
        const nb = (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) ? tile(nx, ny) : null;
        const nbH = nb ? (nb.biome === 'water' ? WATER_LEVEL - 0.05 : nb.height) : -1.5;
        if (nbH >= h - 0.01) continue;
        const bottomY = Math.max(nbH, -1.5);
        const crustY = h - TOPSOIL_THICKNESS;
        const hasCrust = crustY > bottomY + 0.01;

        const pushFace = (col: THREE.Color, top: number, bot: number) => {
          if (n[0] === 1) {
            pushQuad([x1, top, z0], [x1, top, z1], [x1, bot, z1], [x1, bot, z0], n, col);
          } else if (n[0] === -1) {
            pushQuad([x0, top, z1], [x0, top, z0], [x0, bot, z0], [x0, bot, z1], n, col);
          } else if (n[2] === 1) {
            pushQuad([x1, top, z1], [x0, top, z1], [x0, bot, z1], [x1, bot, z1], n, col);
          } else {
            pushQuad([x0, top, z0], [x1, top, z0], [x1, bot, z0], [x0, bot, z0], n, col);
          }
        };

        if (hasCrust) {
          pushFace(topCrust, h, crustY);
          pushFace(subCol, crustY, bottomY);
        } else {
          pushFace(subCol, h, bottomY);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);

  const groundMat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
  const ground = new THREE.Mesh(geo, groundMat);
  ground.name = 'terrain';
  ground.receiveShadow = false;

  // Decorative trees on forest tiles, as instanced meshes (cheap).
  // Three voxel variants — oak, pine, bush — with per-instance scale + yaw.
  const decor = new THREE.Group();
  decor.name = 'decor';

  const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const oak = buildTreeGeom('oak');
  const pine = buildTreeGeom('pine');
  const bush = buildTreeGeom('bush');

  const forestTiles: { x: number; y: number; h: number }[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const t = tile(x, y);
      if (t.biome === 'forest') forestTiles.push({ x, y, h: t.height });
    }
  }

  if (forestTiles.length) {
    // Group tiles by variant so each variant has its own instanced mesh.
    const oakTiles: typeof forestTiles = [];
    const pineTiles: typeof forestTiles = [];
    const bushTiles: typeof forestTiles = [];
    for (const f of forestTiles) {
      const r = hash01(f.x, f.y, 7);
      if (r < 0.55) oakTiles.push(f);
      else if (r < 0.85) pineTiles.push(f);
      else bushTiles.push(f);
    }

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();

    const populate = (geom: THREE.BufferGeometry, tiles: typeof forestTiles, variantSalt: number) => {
      if (!tiles.length) return;
      const mesh = new THREE.InstancedMesh(geom, treeMat, tiles.length);
      mesh.frustumCulled = false;
      let i = 0;
      for (const f of tiles) {
        const jx = (hash01(f.x, f.y, variantSalt * 11 + 1) - 0.5) * 0.36;
        const jz = (hash01(f.x, f.y, variantSalt * 11 + 2) - 0.5) * 0.36;
        const s = 0.85 + hash01(f.x, f.y, variantSalt * 11 + 3) * 0.35;
        const yaw = Math.floor(hash01(f.x, f.y, variantSalt * 11 + 4) * 4) * (Math.PI / 2);
        pos.set(f.x * TILE_SIZE + 0.5 + jx, f.h, f.y * TILE_SIZE + 0.5 + jz);
        eul.set(0, yaw, 0);
        q.setFromEuler(eul);
        scl.set(s, s, s);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i++, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      decor.add(mesh);
    };
    populate(oak, oakTiles, 0);
    populate(pine, pineTiles, 1);
    populate(bush, bushTiles, 2);
  }

  return { ground, decor };
}

// Build one of three voxel tree variants — oak (wide canopy), pine (tall narrow),
// bush (short, no trunk).  All return a single merged geometry with vertex colours.
function buildTreeGeom(kind: 'oak' | 'pine' | 'bush'): THREE.BufferGeometry {
  const parts: Array<{ g: THREE.BufferGeometry; color: number }> = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    parts.push({ g, color });
  };
  if (kind === 'oak') {
    box(0, 0.30, 0, 0.20, 0.60, 0.20, COLOR.woodDark);     // trunk
    box(0, 0.85, 0, 0.85, 0.50, 0.85, COLOR.forest);       // wide canopy
    box(0, 1.18, 0, 0.55, 0.30, 0.55, COLOR.forestCanopy); // top crown
  } else if (kind === 'pine') {
    box(0, 0.40, 0, 0.16, 0.80, 0.16, COLOR.woodDark);     // tall trunk
    box(0, 0.90, 0, 0.70, 0.35, 0.70, COLOR.forestCanopy); // bottom layer
    box(0, 1.20, 0, 0.50, 0.30, 0.50, COLOR.forest);       // middle
    box(0, 1.46, 0, 0.30, 0.22, 0.30, COLOR.forestCanopy); // top spike
  } else {
    box(0, 0.25, 0, 0.65, 0.45, 0.65, COLOR.forest);       // squat ball
    box(0.20, 0.55, 0.05, 0.30, 0.25, 0.30, COLOR.forestCanopy);
    box(-0.18, 0.50, -0.10, 0.25, 0.22, 0.25, COLOR.forestCanopy);
  }

  // Apply vertex colours + merge
  for (const p of parts) {
    const n = p.g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    const c = new THREE.Color(p.color);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
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

function hash01(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
