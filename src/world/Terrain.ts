// Procedural heightmap + biome map for a GRID_SIZE × GRID_SIZE world.
// Deterministic for a given seed.

import { GRID_SIZE } from '../config/constants';
import type { Biome, Tile } from '../types';

// --- noise helpers ---

function hash2(x: number, y: number, seed: number): number {
  let h = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smoothstep(x - x0);
  const fy = smoothstep(y - y0);
  const v00 = hash2(x0, y0, seed);
  const v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);
  return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
}

function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// --- terrain generation ---

export function generateTerrain(seed: number): Tile[] {
  const tiles: Tile[] = new Array(GRID_SIZE * GRID_SIZE);

  // A meandering river runs roughly across the map.
  const riverPhase = hash2(13, 7, seed) * Math.PI * 2;
  const riverY = (x: number) =>
    GRID_SIZE * 0.5 + Math.sin((x / GRID_SIZE) * Math.PI * 2 + riverPhase) * 3.2
      + Math.sin((x / GRID_SIZE) * Math.PI * 5 + riverPhase * 1.7) * 1.2;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      // base height — gentle hills
      const nx = x / GRID_SIZE;
      const ny = y / GRID_SIZE;
      let h = fbm(nx * 3, ny * 3, seed) * 2.4 - 0.3;

      // river carve
      const rY = riverY(x);
      const riverDist = Math.abs(y - rY);
      if (riverDist < 1.0) h = -0.4;
      else if (riverDist < 1.6) h = Math.min(h, -0.05);

      let biome: Biome;
      if (h < -0.05) biome = 'water';
      else if (h < 0.1) biome = 'sand';
      else {
        // forest mask
        const forestN = fbm(nx * 5 + 11.3, ny * 5 + 7.7, seed + 17, 3);
        if (forestN > 0.62 && h < 1.2) biome = 'forest';
        else if (h > 1.0) biome = 'hill';
        else biome = 'grass';
      }

      // quantize for blocky look
      const quantH = biome === 'water' ? -0.3 : Math.round(Math.max(h, 0) * 4) / 4;

      tiles[y * GRID_SIZE + x] = { height: quantH, biome, buildingId: null };
    }
  }

  return tiles;
}

export function tileIdx(x: number, y: number): number {
  return y * GRID_SIZE + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
}

export function getTile(tiles: Tile[], x: number, y: number): Tile | null {
  if (!inBounds(x, y)) return null;
  return tiles[tileIdx(x, y)];
}

// Find a buildable land tile near the center for the starter house.
export function findStarterTile(tiles: Tile[]): { x: number; y: number } {
  const cx = Math.floor(GRID_SIZE / 2);
  const cy = Math.floor(GRID_SIZE / 2);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!inBounds(x, y)) continue;
        const t = tiles[tileIdx(x, y)];
        if (t.biome === 'grass') return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}
