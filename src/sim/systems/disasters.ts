// Fire, plague, raid systems.

import type { GameState, Building } from '../../types';
import { BUILDINGS } from '../../config/buildings';
import {
  DISASTER_GRACE_TICKS,
  FIRE_IGNITION_BASE,
  FIRE_IGNITION_UNCOVERED_MULT,
  FIRE_IGNITION_COVERED_MULT,
  FIRE_SPREAD_CHANCE,
  FIRE_SPREAD_INTERVAL_TICKS,
  FIRE_BURN_TICKS,
  FIRE_EXTINGUISH_TICKS,
  RAIN_FIRE_MULT,
  STORM_LIGHTNING_CHANCE,
  PLAGUE_CHECK_INTERVAL_TICKS,
  PLAGUE_DENSITY_THRESHOLD,
  PLAGUE_WELL_COVERAGE_MIN,
  PLAGUE_ROLL,
  PLAGUE_DURATION_TICKS,
  PLAGUE_POP_LOSS_INTERVAL_TICKS,
  PLAGUE_HOSPITAL_CURE_TICKS,
  PLAGUE_HAPPINESS_DROP,
  RAID_INTERVAL_TICKS,
  RAID_TELEGRAPH_TICKS,
  RAID_EDGE_RANGE,
  RAID_MIN_POP,
  WONDER_DISASTER_MULT,
} from '../../config/balance';
import { GRID_SIZE } from '../../config/constants';
import { withinRadius, footprintTilesAt, getTile, neighbors4 } from '../../world/Grid';
import { pushToast } from '../../ui/panels/EventToast';
import type { Store } from '../Store';

export type DisasterEvents = {
  onFireStart: (b: Building) => void;
  onBuildingDestroyed: (b: Building) => void;
  onRaid: () => void;
};

export function tickDisasters(state: GameState, store: Store, events: DisasterEvents): void {
  const wonderMult = state.wonder.buildingId !== null ? WONDER_DISASTER_MULT : 1;

  // Grace period: no new disasters in the first few minutes.
  if (state.ticks < DISASTER_GRACE_TICKS) return;

  tickFire(state, store, events, wonderMult);
  if (state.city.tier >= 150) tickPlague(state, store);
  if (state.city.pop >= RAID_MIN_POP) tickRaid(state, store, events, wonderMult);

  // age active disasters
  for (let i = state.disasters.length - 1; i >= 0; i--) {
    state.disasters[i].ticksLeft--;
    if (state.disasters[i].ticksLeft <= 0) state.disasters.splice(i, 1);
  }
}

// --- FIRE ---

function isFlammable(b: Building): boolean {
  const def = BUILDINGS[b.type];
  if (def.housing > 0) return true;
  if (b.type === 'workshop' || b.type === 'bakery' || b.type === 'forester') return true;
  return false;
}

function fireCoverage(state: GameState): Uint8Array {
  const cov = new Uint8Array(state.tiles.length);
  for (const b of state.buildings.values()) {
    if (b.type !== 'fireStation') continue;
    if (b.burning !== undefined) continue;
    const def = BUILDINGS[b.type];
    const cx = b.x + Math.floor(def.footprint / 2);
    const cy = b.y + Math.floor(def.footprint / 2);
    withinRadius(cx, cy, def.service!.radius, (x, y) => { cov[y * GRID_SIZE +x] = 1; });
  }
  return cov;
}

function tickFire(state: GameState, store: Store, events: DisasterEvents, wonderMult: number): void {
  const cov = fireCoverage(state);
  const weatherMult = state.weather === 'rain' ? RAIN_FIRE_MULT : 1;

  // Storm lightning
  if (state.weather === 'storm' && Math.random() < STORM_LIGHTNING_CHANCE * wonderMult) {
    const eligible = [...state.buildings.values()].filter(b => isFlammable(b) && b.burning === undefined);
    if (eligible.length) {
      const v = eligible[Math.floor(Math.random() * eligible.length)];
      igniteBuilding(v, state, store, events);
    }
  }

  // Random ignition
  for (const b of state.buildings.values()) {
    if (b.burning !== undefined) continue;
    if (!isFlammable(b)) continue;
    const cx = b.x + Math.floor(BUILDINGS[b.type].footprint / 2);
    const cy = b.y + Math.floor(BUILDINGS[b.type].footprint / 2);
    const covered = cov[cy * GRID_SIZE +cx] === 1;
    const mult = (covered ? FIRE_IGNITION_COVERED_MULT : FIRE_IGNITION_UNCOVERED_MULT) * weatherMult * wonderMult;
    if (Math.random() < FIRE_IGNITION_BASE * mult) {
      igniteBuilding(b, state, store, events);
    }
  }

  // Spread + burn-out / extinguish
  for (const b of [...state.buildings.values()]) {
    if (b.burning === undefined) continue;
    const cx = b.x + Math.floor(BUILDINGS[b.type].footprint / 2);
    const cy = b.y + Math.floor(BUILDINGS[b.type].footprint / 2);
    const covered = cov[cy * GRID_SIZE +cx] === 1;

    if (covered) {
      // extinguish countdown overrides burn
      b.burning -= 1;
      if (b.burning <= 0 || b.burning <= FIRE_BURN_TICKS - FIRE_EXTINGUISH_TICKS) {
        // small risk: burning value below 0 means extinguished
        b.burning = undefined;
        pushToast(store, `Fire extinguished at ${BUILDINGS[b.type].name}`, 'good');
        continue;
      }
    } else {
      b.burning += 1;
    }

    if (b.burning !== undefined && b.burning >= FIRE_BURN_TICKS) {
      // destroyed
      events.onBuildingDestroyed(b);
      continue;
    }

    // spread
    if (b.burning !== undefined && state.ticks % FIRE_SPREAD_INTERVAL_TICKS === 0) {
      for (const t of footprintTilesAt(b.x, b.y, BUILDINGS[b.type].footprint)) {
        for (const n of neighbors4(t.x, t.y)) {
          const tile = getTile(state.tiles, n.x, n.y);
          if (!tile || tile.buildingId === null) continue;
          const nb = state.buildings.get(tile.buildingId);
          if (!nb || nb.burning !== undefined || !isFlammable(nb)) continue;
          if (Math.random() < FIRE_SPREAD_CHANCE * weatherMult) igniteBuilding(nb, state, store, events);
        }
      }
    }
  }
}

function igniteBuilding(b: Building, state: GameState, store: Store, events: DisasterEvents): void {
  if (b.burning !== undefined) return;
  b.burning = 0;
  state.disasters.push({ kind: 'fire', buildingId: b.id, ticksLeft: FIRE_BURN_TICKS });
  pushToast(store, `🔥 Fire at ${BUILDINGS[b.type].name}!`, 'bad');
  events.onFireStart(b);
}

// --- PLAGUE ---

function tickPlague(state: GameState, store: Store): void {
  if (state.ticks % PLAGUE_CHECK_INTERVAL_TICKS !== 0) return;
  if (state.disasters.some(d => d.kind === 'plague')) return; // one at a time

  // Compute housing density per 5x5 + well coverage ratio
  const houses = [...state.buildings.values()].filter(b => BUILDINGS[b.type].housing > 0 && b.burning === undefined);
  if (houses.length === 0) return;

  // Well coverage
  const well = new Uint8Array(state.tiles.length);
  for (const b of state.buildings.values()) {
    if (b.type !== 'well') continue;
    const def = BUILDINGS[b.type];
    const cx = b.x + Math.floor(def.footprint / 2);
    const cy = b.y + Math.floor(def.footprint / 2);
    withinRadius(cx, cy, def.service!.radius, (x, y) => { well[y * GRID_SIZE +x] = 1; });
  }
  let covered = 0;
  for (const h of houses) {
    if (well[h.y * GRID_SIZE +h.x]) covered++;
  }
  const wellRatio = covered / houses.length;

  // density: any 5x5 window with > threshold houses
  const density = new Int8Array(state.tiles.length);
  for (const h of houses) {
    const cx = h.x, cy = h.y;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) continue;
      density[y * GRID_SIZE +x]++;
    }
  }
  let maxDensity = 0;
  for (let i = 0; i < density.length; i++) if (density[i] > maxDensity) maxDensity = density[i];

  if (maxDensity > PLAGUE_DENSITY_THRESHOLD && wellRatio < PLAGUE_WELL_COVERAGE_MIN) {
    if (Math.random() < PLAGUE_ROLL * PLAGUE_CHECK_INTERVAL_TICKS) {
      const dur = PLAGUE_DURATION_TICKS;
      state.disasters.push({ kind: 'plague', ticksLeft: dur, data: { interval: 0, hospital: 0 } });
      state.city.happiness = Math.max(0, state.city.happiness - PLAGUE_HAPPINESS_DROP);
      pushToast(store, '☣ Plague has broken out!', 'bad');
    }
  }

  // Plague effects (per tick) handled here at interval
  for (const d of state.disasters) {
    if (d.kind !== 'plague') continue;
    d.data ??= {};
    d.data.interval = (d.data.interval ?? 0) + PLAGUE_CHECK_INTERVAL_TICKS;
    if (d.data.interval >= PLAGUE_POP_LOSS_INTERVAL_TICKS) {
      d.data.interval = 0;
      state.city.pop = Math.max(0, state.city.pop - 1);
    }
    // Hospital presence accelerates cure
    const hospitals = [...state.buildings.values()].filter(b => b.type === 'hospital');
    if (hospitals.length > 0) {
      d.ticksLeft -= PLAGUE_CHECK_INTERVAL_TICKS * (PLAGUE_DURATION_TICKS / PLAGUE_HOSPITAL_CURE_TICKS - 1);
      if (d.ticksLeft <= 0) pushToast(store, 'Plague cured.', 'good');
    }
  }
}

// --- RAIDS ---

function tickRaid(state: GameState, store: Store, events: DisasterEvents, wonderMult: number): void {
  const interval = Math.floor(RAID_INTERVAL_TICKS / wonderMult);

  // pending raid telegraph
  const pending = state.disasters.find(d => d.kind === 'raid' && (d.data?.phase === 0));
  if (pending) {
    if (pending.ticksLeft <= 0) {
      executeRaid(state, store, events, pending.data?.targetId ?? null);
    }
    return;
  }

  if (state.ticks > 0 && state.ticks % interval === 0) {
    const candidates = pickEdgeCandidates(state);
    if (!candidates.length) return;
    const tgt = candidates[Math.floor(Math.random() * candidates.length)];
    state.disasters.push({
      kind: 'raid',
      ticksLeft: RAID_TELEGRAPH_TICKS,
      data: { phase: 0, targetId: tgt.id },
    });
    pushToast(store, '⚔ Bandits approaching!', 'warn');
  }
}

function pickEdgeCandidates(state: GameState): Building[] {
  return [...state.buildings.values()].filter(b => {
    if (b.type === 'road' || b.type === 'wonder') return false;
    return b.x < RAID_EDGE_RANGE || b.y < RAID_EDGE_RANGE ||
           b.x >= GRID_SIZE - RAID_EDGE_RANGE || b.y >= GRID_SIZE - RAID_EDGE_RANGE;
  });
}

function executeRaid(state: GameState, store: Store, events: DisasterEvents, targetId: number | null): void {
  const safety = new Uint8Array(state.tiles.length);
  for (const b of state.buildings.values()) {
    if (b.type !== 'watchtower') continue;
    const def = BUILDINGS[b.type];
    const cx = b.x + Math.floor(def.footprint / 2);
    const cy = b.y + Math.floor(def.footprint / 2);
    withinRadius(cx, cy, def.service!.radius, (x, y) => { safety[y * GRID_SIZE + x] = 1; });
  }

  const tgt = targetId !== null ? state.buildings.get(targetId) : null;
  if (!tgt) {
    pushToast(store, 'Bandits found nothing.', 'good');
    events.onRaid();
    return;
  }
  const cx = tgt.x + Math.floor(BUILDINGS[tgt.type].footprint / 2);
  const cy = tgt.y + Math.floor(BUILDINGS[tgt.type].footprint / 2);
  if (safety[cy * GRID_SIZE + cx]) {
    pushToast(store, '🛡 Raid repelled by the Watchtower.', 'good');
  } else {
    pushToast(store, `🏚 Bandits destroyed your ${BUILDINGS[tgt.type].name}.`, 'bad');
    events.onBuildingDestroyed(tgt);
  }
  events.onRaid();
}
