// Shared types for Mini City.

export const BUILDING_TYPES = [
  'house', 'cottage', 'tenement',
  'forester', 'quarry', 'farm', 'bakery', 'workshop',
  'market', 'school', 'hospital', 'well', 'bank',
  'stadium', 'park',
  'watchtower', 'fireStation',
  'road', 'wonder',
] as const;
export type BuildingType = typeof BUILDING_TYPES[number];

export type Biome = 'grass' | 'hill' | 'forest' | 'water' | 'sand';

export type Tile = {
  height: number;
  biome: Biome;
  buildingId: number | null;
};

export type Building = {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  hp: number;
  workers: number;
  productionAcc: number;
  burning?: number;
  idle?: boolean;
};

export type Resources = {
  wood: number;
  stone: number;
  food: number;
  coins: number;
  wheat: number;
  goods: number;
};

export type Tier = 0 | 25 | 75 | 150 | 250;

export type CityStats = {
  pop: number;
  housing: number;
  happiness: number;
  tier: Tier;
  food: number;
  water: number;
  safety: number;
  joy: number;
};

export type WeatherKind = 'clear' | 'rain' | 'storm';

export type DisasterKind = 'fire' | 'plague' | 'raid';

export type ActiveDisaster = {
  kind: DisasterKind;
  buildingId?: number;
  ticksLeft: number;
  data?: Record<string, number>;
};

export type Wonder = {
  buildingId: number | null;
  progress: number;
  total: number;
};

export type GameState = {
  version: 1;
  seed: number;
  ticks: number;
  resources: Resources;
  city: CityStats;
  tiles: Tile[];
  buildings: Map<number, Building>;
  nextBuildingId: number;
  selectedBuildType: BuildingType | 'demolish' | null;
  selectedBuildingId: number | null;
  camera: { rotation: 0 | 1 | 2 | 3; zoom: number; targetX: number; targetZ: number };
  weather: WeatherKind;
  weatherTicksLeft: number;
  daytime: number;
  dayCycleScale: number;
  muted: boolean;
  paused: boolean;
  simSpeed: 1 | 2 | 4;
  achievements: Record<string, true>;
  tutorial: { step: number; done: boolean };
  disasters: ActiveDisaster[];
  wonder: Wonder;
  ended: 'won' | null;
  dirty: { buildings: boolean; resources: boolean; city: boolean; menu: boolean; toast: boolean };
};
