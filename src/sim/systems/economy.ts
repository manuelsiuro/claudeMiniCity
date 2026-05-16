// Production and consumption. Runs every PRODUCTION_INTERVAL_TICKS.

import type { GameState, Building, Tile } from '../../types';
import { BUILDINGS } from '../../config/buildings';

export type EconomyEvents = {
  onProduce?: (b: Building, resource: keyof GameState['resources'], amount: number) => void;
};
import {
  PRODUCTION_INTERVAL_TICKS,
  FOOD_PER_POP_PER_TICK,
  ROAD_BONUS_LENGTH,
  ROAD_BONUS_PCT,
  SCHOOL_WORKSHOP_BONUS_PCT,
} from '../../config/balance';
import { GRID_SIZE } from '../../config/constants';
import { getTile, neighbors4, withinRadius, footprintTilesAt } from '../../world/Grid';
import { computeJobs } from './jobs';

export function tickEconomy(state: GameState, events?: EconomyEvents): void {
  if (state.ticks % PRODUCTION_INTERVAL_TICKS !== 0) {
    // Food consumption happens every tick, not every 4
    consumeFood(state);
    return;
  }

  // Compute global modifiers
  const jobs = computeJobs(state);
  const employmentRatio = jobs.ratio;

  // Pre-compute service coverage flags (school, fireStation, bank) on tiles
  const flags = computeServiceFlags(state);

  // Run producers
  for (const b of state.buildings.values()) {
    if (b.burning !== undefined) continue;
    const def = BUILDINGS[b.type];
    if (!def.produces) continue;

    // road needed?
    if (def.needsRoad && !hasAdjacentRoadAny(state, b)) { b.idle = true; continue; }

    // biome requirement?
    if (def.produces.needsBiome) {
      const range = def.produces.needsBiomeRange ?? 0;
      const ok = checkBiome(state.tiles, b, def.footprint, def.produces.needsBiome, range);
      if (!ok) { b.idle = true; continue; }
    }

    b.idle = false;

    // consume input resources
    if (def.produces.consume) {
      const c = def.produces.consume;
      let canPay = true;
      if (c.wood && state.resources.wood < c.wood) canPay = false;
      if (c.stone && state.resources.stone < c.stone) canPay = false;
      if (c.wheat && state.resources.wheat < c.wheat) canPay = false;
      if (c.food && state.resources.food < c.food) canPay = false;
      if (c.goods && state.resources.goods < c.goods) canPay = false;
      if (!canPay) continue;
      if (c.wood) state.resources.wood -= c.wood;
      if (c.stone) state.resources.stone -= c.stone;
      if (c.wheat) state.resources.wheat -= c.wheat;
      if (c.food) state.resources.food -= c.food;
      if (c.goods) state.resources.goods -= c.goods;
    }

    let amount = def.produces.perTick;

    // Road run bonus
    if (countAdjacentRoadRun(state, b) >= ROAD_BONUS_LENGTH) amount *= 1 + ROAD_BONUS_PCT;

    // School bonus for workshop
    if (b.type === 'workshop' && hasFlag(flags, b, 'school', def.footprint)) {
      amount *= 1 + SCHOOL_WORKSHOP_BONUS_PCT;
    }

    // Employment scaling for jobs > 0
    if (def.jobs > 0) amount *= employmentRatio;

    state.resources[def.produces.out] += amount;
    events?.onProduce?.(b, def.produces.out, amount);
  }

  // Upkeep
  for (const b of state.buildings.values()) {
    if (b.burning !== undefined) continue;
    const def = BUILDINGS[b.type];
    if (def.upkeep) state.resources.coins -= def.upkeep;
  }

  state.dirty.resources = true;
}

function consumeFood(state: GameState): void {
  const drain = state.city.pop * FOOD_PER_POP_PER_TICK / 4; // per-tick fraction
  state.resources.food -= drain;
  if (state.resources.food < 0) state.resources.food = Math.max(state.resources.food, -50);
  state.dirty.resources = true;
}

function hasAdjacentRoadAny(state: GameState, b: Building): boolean {
  const def = BUILDINGS[b.type];
  for (const t of footprintTilesAt(b.x, b.y, def.footprint)) {
    for (const n of neighbors4(t.x, t.y)) {
      const tile = getTile(state.tiles, n.x, n.y);
      if (!tile || tile.buildingId === null) continue;
      const nb = state.buildings.get(tile.buildingId);
      if (nb?.type === 'road') return true;
    }
  }
  return false;
}

function countAdjacentRoadRun(state: GameState, b: Building): number {
  // simple BFS counting connected road tiles within 8-radius of building
  let count = 0;
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [];
  for (const t of footprintTilesAt(b.x, b.y, BUILDINGS[b.type].footprint)) {
    for (const n of neighbors4(t.x, t.y)) queue.push(n);
  }
  while (queue.length && count < 12) {
    const n = queue.pop()!;
    const key = `${n.x},${n.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const tile = getTile(state.tiles, n.x, n.y);
    if (!tile || tile.buildingId === null) continue;
    const nb = state.buildings.get(tile.buildingId);
    if (nb?.type !== 'road') continue;
    count++;
    for (const m of neighbors4(n.x, n.y)) queue.push(m);
  }
  return count;
}

function checkBiome(
  tiles: Tile[],
  b: Building,
  footprint: number,
  biome: 'forest' | 'hill' | 'grass',
  range: number,
): boolean {
  if (range === 0) {
    // require footprint tile biome
    for (const t of footprintTilesAt(b.x, b.y, footprint)) {
      const tile = getTile(tiles, t.x, t.y);
      if (!tile || tile.biome !== biome) return false;
    }
    return true;
  }
  // any tile within range matching biome
  let found = false;
  const cx = b.x + Math.floor(footprint / 2);
  const cy = b.y + Math.floor(footprint / 2);
  withinRadius(cx, cy, range, (x, y) => {
    if (found) return;
    const tile = getTile(tiles, x, y);
    if (tile?.biome === biome) found = true;
  });
  return found;
}

export type CoverageFlag = 'school' | 'fire' | 'bank';
type CoverageMap = Uint8Array;

const FLAG_BITS: Record<CoverageFlag, number> = {
  school: 1,
  fire: 2,
  bank: 4,
};

function computeServiceFlags(state: GameState): CoverageMap {
  const arr = new Uint8Array(state.tiles.length);
  for (const b of state.buildings.values()) {
    const def = BUILDINGS[b.type];
    if (!def.service) continue;
    const flagKey: CoverageFlag | null =
      def.service.kind === 'school' ? 'school'
      : def.service.kind === 'fire' ? 'fire'
      : def.service.kind === 'bank' ? 'bank'
      : null;
    if (!flagKey) continue;
    const bit = FLAG_BITS[flagKey];
    const cx = b.x + Math.floor(def.footprint / 2);
    const cy = b.y + Math.floor(def.footprint / 2);
    withinRadius(cx, cy, def.service.radius, (x, y) => {
      arr[y * GRID_SIZE + x] = (arr[y * GRID_SIZE + x] | bit) & 0xff;
    });
  }
  return arr;
}

function hasFlag(flags: CoverageMap, b: Building, kind: CoverageFlag, footprint: number): boolean {
  const bit = FLAG_BITS[kind];
  for (const t of footprintTilesAt(b.x, b.y, footprint)) {
    if ((flags[t.y * GRID_SIZE + t.x] & bit) !== 0) return true;
  }
  return false;
}
