// Static constants used across modules.

export const GRID_SIZE = 24;
export const TILE_SIZE = 1;
export const TICK_MS = 250;
export const TICKS_PER_SECOND = 1000 / TICK_MS;

export const MAX_BUILDINGS_PER_TYPE = GRID_SIZE * GRID_SIZE;

export const DEFAULT_SEED = 1729;

export const CAMERA_ZOOM_MIN = 5;
export const CAMERA_ZOOM_MAX = 22;
export const CAMERA_ZOOM_DEFAULT = 9;
export const CAMERA_PITCH = Math.PI / 6; // 30° — lower, drysland-like over-the-shoulder iso

export const COLOR = {
  grass: 0x4a9b3a,
  grassDark: 0x3e8330,
  hill: 0x6b7d3e,
  hillTop: 0x8aa055,
  forest: 0x2d5a1f,
  forestCanopy: 0x224a18,
  water: 0x2f6fbc,
  waterDeep: 0x224f8c,
  sand: 0xd6c388,
  wood: 0x8b5a2b,
  woodDark: 0x5e3d1f,
  dirt: 0x6b4a2b,
  dirtDark: 0x4a3220,
  rock: 0x8a8478,
  rockDark: 0x595449,
  stone: 0x808080,
  stoneDark: 0x4a4a4a,
  white: 0xeae5d6,
  cream: 0xe8d6a6,
  tan: 0xc9a472,
  red: 0xc44a3e,
  redDark: 0x7c2a22,
  brick: 0x9c4a3a,
  slate: 0x404652,
  yellow: 0xf2c84b,
  windowYellow: 0xffe27a,
  windowBlue: 0x9ed7ff,
  gold: 0xf2c84b,
  pink: 0xe89cb4,
  smoke: 0x2a2a2a,
  fire: 0xff7842,
  fireBright: 0xffd34a,
} as const;
