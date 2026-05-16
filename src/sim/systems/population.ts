// Aggregate population, needs, and happiness.

import type { GameState } from '../../types';
import { BUILDINGS } from '../../config/buildings';
import {
  CITIZEN_SPAWN_INTERVAL_TICKS,
  HAPPINESS_SPAWN_THRESHOLD,
  HAPPINESS_MIGRATION_THRESHOLD,
  STARVATION_RATE,
} from '../../config/balance';
import { withinRadius, footprintTilesAt } from '../../world/Grid';
import { GRID_SIZE } from '../../config/constants';

export function tickPopulation(state: GameState): void {
  // 1. Compute housing total
  let housing = 0;
  for (const b of state.buildings.values()) {
    if (b.burning !== undefined) continue;
    housing += BUILDINGS[b.type].housing;
  }
  state.city.housing = housing;

  // 2. Update needs every 4 ticks (responsive enough)
  if (state.ticks % 4 === 0) {
    recomputeNeeds(state);
  }

  // 3. Spawn / migration
  if (state.ticks % CITIZEN_SPAWN_INTERVAL_TICKS === 0) {
    if (state.resources.food < 0) {
      state.city.pop = Math.max(0, state.city.pop - STARVATION_RATE);
    } else if (state.city.happiness < HAPPINESS_MIGRATION_THRESHOLD) {
      state.city.pop = Math.max(0, state.city.pop - 1);
    } else if (state.city.pop < housing && state.city.happiness >= HAPPINESS_SPAWN_THRESHOLD) {
      state.city.pop += 1;
    }
  }

  state.dirty.city = true;
}

function recomputeNeeds(state: GameState): void {
  // Locate housing centers
  const houses: Array<{ x: number; y: number; w: number }> = [];
  for (const b of state.buildings.values()) {
    const def = BUILDINGS[b.type];
    if (def.housing === 0) continue;
    if (b.burning !== undefined) continue;
    const cx = b.x + Math.floor(def.footprint / 2);
    const cy = b.y + Math.floor(def.footprint / 2);
    houses.push({ x: cx, y: cy, w: def.housing });
  }
  const totalH = houses.reduce((s, h) => s + h.w, 0) || 1;

  // Build coverage maps for water/safety, and happiness aura accumulators
  const water = new Uint8Array(state.tiles.length);
  const safety = new Uint8Array(state.tiles.length);
  const joy = new Int8Array(state.tiles.length);

  for (const b of state.buildings.values()) {
    if (b.burning !== undefined) continue;
    const def = BUILDINGS[b.type];
    if (!def.service) continue;
    const cx = b.x + Math.floor(def.footprint / 2);
    const cy = b.y + Math.floor(def.footprint / 2);
    if (def.service.kind === 'water') {
      withinRadius(cx, cy, def.service.radius, (x, y) => { water[y * GRID_SIZE +x] = 1; });
    } else if (def.service.kind === 'safety') {
      withinRadius(cx, cy, def.service.radius, (x, y) => { safety[y * GRID_SIZE +x] = 1; });
    } else if (def.service.kind === 'happiness' || def.service.kind === 'school') {
      withinRadius(cx, cy, def.service.radius, (x, y) => {
        joy[y * GRID_SIZE +x] = Math.max(-30, Math.min(30, joy[y * GRID_SIZE +x] + def.service!.strength));
      });
    }
  }

  // Score needs from house tiles
  let waterScore = 0, safetyScore = 0, joyScore = 0;
  for (const h of houses) {
    const idx = h.y * GRID_SIZE +h.x;
    if (water[idx]) waterScore += h.w;
    if (safety[idx] || state.city.tier < 75) safetyScore += h.w; // pre-tier-75 = no raids
    joyScore += Math.max(0, joy[idx]) * h.w;
  }

  const foodScore = state.resources.food > 0 ? 100 : 0;
  const waterPct = (waterScore / totalH) * 100;
  const safetyPct = (safetyScore / totalH) * 100;
  const joyPct = Math.min(100, (joyScore / totalH) * 20);

  state.city.food = foodScore;
  state.city.water = waterPct;
  state.city.safety = safetyPct;
  state.city.joy = joyPct;

  let h = (foodScore + waterPct + safetyPct + joyPct) / 4;
  h -= state.disasters.length * 5;
  if (state.resources.food < 0) h -= 10;
  if (state.resources.coins < 0) h -= 1;
  state.city.happiness = Math.max(0, Math.min(100, h));
}

// Called when a building is placed/destroyed.
// Just re-flags dirty.city for the next tick recompute.
export function markCityDirty(state: GameState): void {
  state.dirty.city = true;
}

// Mark all buildings adjacent to/inside footprint as workers-recomputed.
// Called by the actions layer when a producer is placed/removed.
export function resetWorkers(_state: GameState, _bx: number, _by: number, _fp: number): void {
  // No-op: jobs computed each tick from totals. Kept for API consistency.
}
export { footprintTilesAt };
