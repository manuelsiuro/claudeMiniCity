// Save/Load GameState <-> JSON. Versioned.

import type { GameState, Building, Tile } from '../types';
import { readSave, writeSave, clearSave } from './Storage';

type SerializedV1 = {
  version: 1;
  seed: number;
  ticks: number;
  resources: GameState['resources'];
  city: GameState['city'];
  tiles: Array<[number, string, number | null]>; // [height, biome, buildingId]
  buildings: Array<[number, string, number, number, number, number, number, number | undefined, boolean | undefined]>;
  nextBuildingId: number;
  selectedBuildType: GameState['selectedBuildType'];
  camera: GameState['camera'];
  weather: GameState['weather'];
  weatherTicksLeft: number;
  daytime: number;
  tutorial: GameState['tutorial'];
  disasters: GameState['disasters'];
  wonder: GameState['wonder'];
  ended: GameState['ended'];
};

export function serialize(state: GameState): string {
  const payload: SerializedV1 = {
    version: 1,
    seed: state.seed,
    ticks: state.ticks,
    resources: state.resources,
    city: state.city,
    tiles: state.tiles.map<[number, string, number | null]>((t: Tile) => [t.height, t.biome, t.buildingId]),
    buildings: [...state.buildings.values()].map<SerializedV1['buildings'][number]>((b: Building) => [
      b.id, b.type, b.x, b.y, b.hp, b.workers, b.productionAcc, b.burning, b.idle,
    ]),
    nextBuildingId: state.nextBuildingId,
    selectedBuildType: state.selectedBuildType,
    camera: state.camera,
    weather: state.weather,
    weatherTicksLeft: state.weatherTicksLeft,
    daytime: state.daytime,
    tutorial: state.tutorial,
    disasters: state.disasters,
    wonder: state.wonder,
    ended: state.ended,
  };
  return JSON.stringify(payload);
}

export function loadOrNull(): GameState | null {
  const raw = readSave();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version: number };
    if (parsed.version !== 1) return null;
    return deserialize(parsed as SerializedV1);
  } catch {
    return null;
  }
}

function deserialize(p: SerializedV1): GameState {
  const tiles: Tile[] = p.tiles.map(([h, b, id]) => ({
    height: h,
    biome: b as Tile['biome'],
    buildingId: id,
  }));
  const buildings = new Map<number, Building>();
  for (const row of p.buildings) {
    const [id, type, x, y, hp, workers, productionAcc, burning, idle] = row;
    buildings.set(id, {
      id, type: type as Building['type'], x, y, hp, workers, productionAcc,
      burning: burning === null ? undefined : burning,
      idle,
    });
  }
  return {
    version: 1,
    seed: p.seed,
    ticks: p.ticks,
    resources: p.resources,
    city: p.city,
    tiles,
    buildings,
    nextBuildingId: p.nextBuildingId,
    selectedBuildType: p.selectedBuildType,
    selectedBuildingId: null,
    dayCycleScale: 1.0,
    muted: false,
    paused: false,
    simSpeed: 1,
    achievements: (p as unknown as { achievements?: Record<string, true> }).achievements ?? {},
    camera: p.camera,
    weather: p.weather,
    weatherTicksLeft: p.weatherTicksLeft,
    daytime: p.daytime,
    tutorial: p.tutorial,
    disasters: p.disasters,
    wonder: p.wonder,
    ended: p.ended,
    dirty: { buildings: true, resources: true, city: true, menu: true, toast: false },
  };
}

export function saveTo(state: GameState): void {
  writeSave(serialize(state));
}

export function wipeSave(): void {
  clearSave();
}
