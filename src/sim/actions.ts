// Single entry point for mutations. UI and systems call into here.

import type { GameState, BuildingType, Building } from '../types';
import { BUILDINGS } from '../config/buildings';
import { Store, type Slice } from './Store';
import { getTile, inBounds, footprintTilesAt, neighbors4 } from '../world/Grid';
import { unlockedTypes } from '../config/milestones';

export type PlaceResult =
  | { ok: true; building: Building }
  | { ok: false; reason: string };

export class Actions {
  constructor(private store: Store) {}

  selectBuildType(type: BuildingType | 'demolish' | null): void {
    this.store.state.selectedBuildType = type;
    this.store.notify('menu');
  }

  rotateCamera(_dir: 1 | -1): void {
    this.store.state.dirty.buildings = true; // not strictly needed but cheap
  }

  canPlace(type: BuildingType, x: number, y: number): { ok: boolean; reason?: string } {
    const s = this.store.state;
    const def = BUILDINGS[type];

    // tier check
    const unlocked = unlockedTypes(s.city.pop);
    if (!unlocked.has(type)) return { ok: false, reason: 'Locked' };

    // tiles in footprint must all be empty land
    for (const t of footprintTilesAt(x, y, def.footprint)) {
      if (!inBounds(t.x, t.y)) return { ok: false, reason: 'Out of bounds' };
      const tile = getTile(s.tiles, t.x, t.y)!;
      if (tile.biome === 'water') return { ok: false, reason: 'Water' };
      if (tile.buildingId !== null) return { ok: false, reason: 'Occupied' };
    }

    // road adjacency for non-house non-road
    if (def.needsRoad) {
      const adj = hasAdjacentRoad(s, x, y, def.footprint);
      if (!adj) return { ok: false, reason: 'Needs adjacent road' };
    }

    // wonder only once
    if (type === 'wonder' && s.wonder.buildingId !== null) {
      return { ok: false, reason: 'Wonder already started' };
    }

    // cost
    const cost = def.cost;
    if (s.resources.wood < cost.wood) return { ok: false, reason: 'Not enough wood' };
    if (s.resources.stone < cost.stone) return { ok: false, reason: 'Not enough stone' };
    if (s.resources.coins < cost.coins) return { ok: false, reason: 'Not enough coins' };

    return { ok: true };
  }

  placeBuilding(type: BuildingType, x: number, y: number): PlaceResult {
    const ok = this.canPlace(type, x, y);
    if (!ok.ok) return { ok: false, reason: ok.reason! };

    const s = this.store.state;
    const def = BUILDINGS[type];

    // spend
    s.resources.wood -= def.cost.wood;
    s.resources.stone -= def.cost.stone;
    s.resources.coins -= def.cost.coins;

    const id = s.nextBuildingId++;
    const b: Building = {
      id, type, x, y,
      hp: 100,
      workers: 0,
      productionAcc: 0,
    };
    s.buildings.set(id, b);

    for (const t of footprintTilesAt(x, y, def.footprint)) {
      const tile = getTile(s.tiles, t.x, t.y)!;
      tile.buildingId = id;
    }

    if (type === 'wonder') {
      s.wonder.buildingId = id;
      s.wonder.progress = 0;
    }

    s.dirty.buildings = true;
    s.dirty.resources = true;
    s.dirty.city = true; // housing changes
    this.store.notify('buildings');
    this.store.notify('resources');

    return { ok: true, building: b };
  }

  demolish(x: number, y: number): boolean {
    const s = this.store.state;
    const tile = getTile(s.tiles, x, y);
    if (!tile || tile.buildingId === null) return false;
    const b = s.buildings.get(tile.buildingId);
    if (!b) return false;
    return this.removeBuilding(b);
  }

  removeBuilding(b: Building): boolean {
    const s = this.store.state;
    const def = BUILDINGS[b.type];

    // refund 50% wood/stone, 25% coins
    s.resources.wood += Math.floor(def.cost.wood * 0.5);
    s.resources.stone += Math.floor(def.cost.stone * 0.5);
    s.resources.coins += Math.floor(def.cost.coins * 0.25);

    for (const t of footprintTilesAt(b.x, b.y, def.footprint)) {
      const tile = getTile(s.tiles, t.x, t.y);
      if (tile) tile.buildingId = null;
    }
    s.buildings.delete(b.id);

    if (b.type === 'wonder') {
      s.wonder.buildingId = null;
      s.wonder.progress = 0;
    }

    s.dirty.buildings = true;
    s.dirty.resources = true;
    s.dirty.city = true;
    this.store.notify('buildings');
    this.store.notify('resources');
    return true;
  }

  addResources(d: Partial<{ wood: number; stone: number; food: number; coins: number; wheat: number; goods: number }>): void {
    const r = this.store.state.resources;
    if (d.wood) r.wood += d.wood;
    if (d.stone) r.stone += d.stone;
    if (d.food) r.food += d.food;
    if (d.coins) r.coins += d.coins;
    if (d.wheat) r.wheat += d.wheat;
    if (d.goods) r.goods += d.goods;
    this.store.state.dirty.resources = true;
    this.store.notify('resources');
  }

  notify(slice: Slice): void {
    this.store.notify(slice);
  }
}

function hasAdjacentRoad(state: GameState, x: number, y: number, fp: number): boolean {
  // any tile of the footprint must be adjacent (4-neighbor) to a road tile.
  for (const t of footprintTilesAt(x, y, fp)) {
    for (const n of neighbors4(t.x, t.y)) {
      const tile = getTile(state.tiles, n.x, n.y);
      if (!tile || tile.buildingId === null) continue;
      const b = state.buildings.get(tile.buildingId);
      if (b && b.type === 'road') return true;
    }
  }
  return false;
}
