import type { GameState } from '../types';
import { STARTING_RESOURCES } from '../config/balance';
import { GRID_SIZE, CAMERA_ZOOM_DEFAULT, DEFAULT_SEED } from '../config/constants';

export type Slice =
  | 'resources'
  | 'city'
  | 'buildings'
  | 'menu'
  | 'tutorial'
  | 'toast'
  | 'weather'
  | 'wonder'
  | 'info'
  | 'achievement'
  | 'end';

type Listener = () => void;

export class Store {
  state: GameState;
  private listeners = new Map<Slice, Set<Listener>>();

  constructor(initial: GameState) {
    this.state = initial;
  }

  subscribe(slice: Slice, fn: Listener): () => void {
    let set = this.listeners.get(slice);
    if (!set) {
      set = new Set();
      this.listeners.set(slice, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  notify(slice: Slice): void {
    const set = this.listeners.get(slice);
    if (!set) return;
    for (const fn of set) fn();
  }
}

export function createInitialState(seed = DEFAULT_SEED): GameState {
  return {
    version: 1,
    seed,
    ticks: 168,    // start at ~mid-morning so the world opens lit
    resources: { ...STARTING_RESOURCES },
    city: {
      pop: 0,
      housing: 0,
      happiness: 70,
      tier: 0,
      food: 100,
      water: 0,
      safety: 100,
      joy: 0,
    },
    tiles: [],
    buildings: new Map(),
    nextBuildingId: 1,
    selectedBuildType: null,
    selectedBuildingId: null,
    camera: {
      rotation: 0,
      zoom: CAMERA_ZOOM_DEFAULT,
      targetX: GRID_SIZE / 2,
      targetZ: GRID_SIZE / 2,
    },
    weather: 'clear',
    weatherTicksLeft: 720,
    daytime: 0.35,
    dayCycleScale: 1.0,
    muted: false,
    paused: false,
    simSpeed: 1,
    achievements: {},
    tutorial: { step: 0, done: false },
    disasters: [],
    wonder: { buildingId: null, progress: 0, total: 120 },
    ended: null,
    dirty: { buildings: false, resources: false, city: false, menu: false, toast: false },
  };
}
