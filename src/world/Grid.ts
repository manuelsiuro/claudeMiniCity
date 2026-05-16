// Grid helpers shared by sim systems and rendering.

import { GRID_SIZE } from '../config/constants';
import type { Tile, Building } from '../types';
import { BUILDINGS } from '../config/buildings';

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

export function footprintTiles(b: Building): Array<{ x: number; y: number }> {
  const fp = BUILDINGS[b.type].footprint;
  const out: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < fp; dy++) {
    for (let dx = 0; dx < fp; dx++) {
      out.push({ x: b.x + dx, y: b.y + dy });
    }
  }
  return out;
}

export function footprintTilesAt(x: number, y: number, footprint: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      out.push({ x: x + dx, y: y + dy });
    }
  }
  return out;
}

// Returns the average ground height across a building's footprint
// (where the visible base of the voxel mesh should sit).
export function footprintHeight(tiles: Tile[], x: number, y: number, footprint: number): number {
  let max = -Infinity;
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      const t = getTile(tiles, x + dx, y + dy);
      if (t && t.biome !== 'water') max = Math.max(max, t.height);
    }
  }
  return max === -Infinity ? 0 : max;
}

export function neighbors4(x: number, y: number): Array<{ x: number; y: number }> {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}

export function withinRadius(
  cx: number, cy: number, r: number,
  fn: (x: number, y: number) => void,
): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, y)) continue;
      if (Math.abs(x - cx) + Math.abs(y - cy) > r) continue; // diamond range
      fn(x, y);
    }
  }
}

export function eachTile(fn: (x: number, y: number, idx: number) => void): void {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      fn(x, y, y * GRID_SIZE + x);
    }
  }
}
