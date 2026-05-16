import { COLOR } from './constants';
import type { BuildingType, Tier } from '../types';

// A voxel "part" = a box, offsets in tile-local space.
// y = 0 sits on top of terrain. x,z are centered around tile center.
// For a 1x1 footprint, parts should fit in [-0.5..0.5] x [-0.5..0.5].
// For a 2x2 footprint, parts should fit in [-1..1] x [-1..1] (centered on the corner-of-4-tiles).
// For a 3x3 footprint, fit in [-1.5..1.5] x [-1.5..1.5].
export type VoxelPart = {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  color: number;
};

export type Production = {
  out: 'wood' | 'stone' | 'wheat' | 'food' | 'goods' | 'coins';
  perTick: number;
  needsBiome?: 'forest' | 'hill' | 'grass';
  needsBiomeRange?: number;
  consume?: Partial<{ wood: number; stone: number; wheat: number; food: number; goods: number }>;
};

export type Service = {
  kind: 'happiness' | 'water' | 'safety' | 'fire' | 'cure' | 'school' | 'bank';
  radius: number;
  strength: number;
};

export type BuildingDef = {
  id: BuildingType;
  name: string;
  footprint: 1 | 2 | 3;
  tier: Tier;
  cost: { wood: number; stone: number; coins: number };
  upkeep: number;
  jobs: number;
  housing: number;
  parts: VoxelPart[];
  produces?: Production;
  service?: Service;
  needsRoad: boolean;
  desc: string;
};

const p = (x: number, y: number, z: number, w: number, h: number, d: number, color: number): VoxelPart =>
  ({ x, y, z, w, h, d, color });

// ============================================================================
// Voxel compositions (Minecraft-style blocky silhouettes).
// ============================================================================

const HOUSE_PARTS: VoxelPart[] = [
  p(0, 0.05, 0, 0.88, 0.10, 0.88, COLOR.stone),              // stone foundation
  p(0, 0.30, 0, 0.78, 0.40, 0.78, COLOR.cream),              // walls
  p(0, 0.62, 0, 0.92, 0.22, 0.92, COLOR.red),                // roof slab
  p(0, 0.78, 0, 0.55, 0.12, 0.55, COLOR.redDark),            // roof cap
  p(-0.25, 0.86, 0.25, 0.12, 0.32, 0.12, COLOR.stoneDark),   // chimney
  p(-0.25, 1.04, 0.25, 0.16, 0.06, 0.16, COLOR.stone),       // chimney top
  p(0, 0.22, 0.40, 0.18, 0.30, 0.04, COLOR.woodDark),        // door
  p(0, 0.15, 0.40, 0.08, 0.04, 0.04, COLOR.gold),            // door knob
  p(-0.25, 0.36, 0.40, 0.13, 0.13, 0.03, COLOR.windowYellow),// left window
  p(0.25, 0.36, 0.40, 0.13, 0.13, 0.03, COLOR.windowYellow), // right window
];

const COTTAGE_PARTS: VoxelPart[] = [
  p(0, 0.3, 0, 0.85, 0.6, 0.85, COLOR.tan),
  p(0, 0.7, 0, 0.95, 0.22, 0.95, COLOR.brick),
  p(0, 0.85, 0, 0.55, 0.1, 0.55, COLOR.redDark),
  p(-0.3, 0.3, 0.43, 0.12, 0.12, 0.03, COLOR.windowYellow),
  p(0.3, 0.3, 0.43, 0.12, 0.12, 0.03, COLOR.windowYellow),
  p(0, 0.2, 0.43, 0.2, 0.4, 0.04, COLOR.woodDark),           // door
  p(0.3, 0.92, -0.25, 0.12, 0.18, 0.12, COLOR.stone),        // chimney
];

const TENEMENT_PARTS: VoxelPart[] = [
  p(0, 0.8, 0, 1.7, 1.6, 1.7, COLOR.stoneDark),
  p(0, 1.65, 0, 1.85, 0.15, 1.85, COLOR.slate),
  // window grid (8 windows on front face)
  p(-0.55, 0.6, 0.86, 0.14, 0.14, 0.03, COLOR.windowYellow),
  p(-0.18, 0.6, 0.86, 0.14, 0.14, 0.03, COLOR.windowYellow),
  p(0.18, 0.6, 0.86, 0.14, 0.14, 0.03, COLOR.windowYellow),
  p(0.55, 0.6, 0.86, 0.14, 0.14, 0.03, COLOR.windowYellow),
  p(-0.55, 1.05, 0.86, 0.14, 0.14, 0.03, COLOR.windowYellow),
  p(-0.18, 1.05, 0.86, 0.14, 0.14, 0.03, COLOR.windowYellow),
  p(0.18, 1.05, 0.86, 0.14, 0.14, 0.03, COLOR.windowYellow),
  p(0.55, 1.05, 0.86, 0.14, 0.14, 0.03, COLOR.windowYellow),
];

const FORESTER_PARTS: VoxelPart[] = [
  p(-0.10, 0.30, -0.10, 0.58, 0.55, 0.58, COLOR.wood),        // cabin walls
  p(-0.10, 0.62, -0.10, 0.68, 0.18, 0.68, COLOR.stoneDark),   // sloped roof slab
  p(-0.10, 0.76, -0.10, 0.40, 0.10, 0.40, COLOR.slate),       // roof cap
  p(-0.10, 0.22, 0.20, 0.16, 0.30, 0.04, COLOR.woodDark),     // cabin door
  // log pile, three logs lying
  p(0.32, 0.13, 0.34, 0.28, 0.10, 0.10, COLOR.wood),
  p(0.32, 0.13, 0.22, 0.28, 0.10, 0.10, COLOR.woodDark),
  p(0.32, 0.23, 0.28, 0.28, 0.10, 0.10, COLOR.wood),
  // axe stuck in stump
  p(0.30, 0.18, -0.30, 0.14, 0.18, 0.14, COLOR.woodDark),     // stump
  p(0.30, 0.36, -0.30, 0.04, 0.18, 0.04, COLOR.wood),         // axe handle
  p(0.30, 0.50, -0.30, 0.12, 0.06, 0.04, COLOR.stoneDark),    // axe head
];

const QUARRY_PARTS: VoxelPart[] = [
  p(0, 0.05, 0, 1.7, 0.10, 1.7, 0x3a3a3a),                     // dug pit floor
  // big rough stone heap
  p(-0.55, 0.28, -0.55, 0.40, 0.46, 0.40, COLOR.stone),
  p(-0.55, 0.55, -0.55, 0.28, 0.20, 0.28, COLOR.rock),
  p(0.40, 0.20, 0.40, 0.46, 0.30, 0.46, COLOR.stone),
  p(0.45, 0.42, 0.45, 0.22, 0.16, 0.22, COLOR.rockDark),
  p(0.55, 0.16, -0.55, 0.30, 0.22, 0.30, COLOR.rock),
  // worker hut with sloped roof
  p(-0.55, 0.38, 0.55, 0.32, 0.58, 0.32, COLOR.woodDark),
  p(-0.55, 0.70, 0.55, 0.42, 0.14, 0.42, COLOR.slate),
  p(-0.55, 0.30, 0.69, 0.10, 0.20, 0.04, COLOR.windowYellow),
  // wooden cart with stones
  p(0.55, 0.20, 0.55, 0.34, 0.18, 0.22, COLOR.wood),
  p(0.55, 0.30, 0.55, 0.28, 0.10, 0.18, COLOR.stone),
  // pick-axe
  p(0.20, 0.20, -0.20, 0.04, 0.30, 0.04, COLOR.woodDark),
  p(0.20, 0.36, -0.20, 0.18, 0.06, 0.04, COLOR.stoneDark),
];

const FARM_PARTS: VoxelPart[] = [
  // barn with cross-pattern wall
  p(-0.55, 0.40, 0.55, 0.50, 0.70, 0.50, COLOR.red),
  p(-0.55, 0.40, 0.81, 0.50, 0.08, 0.02, COLOR.white),         // white trim
  p(-0.55, 0.78, 0.55, 0.62, 0.22, 0.55, COLOR.redDark),       // barn roof
  p(-0.55, 0.92, 0.55, 0.34, 0.10, 0.30, 0x4a1a14),            // ridge
  p(-0.55, 0.34, 0.81, 0.18, 0.34, 0.02, COLOR.woodDark),      // barn door
  // tilled crop rows (alternating dark soil + golden grain)
  p(0.40, 0.10, -0.40, 0.55, 0.06, 0.55, COLOR.dirt),
  p(0.40, 0.14, -0.40, 0.50, 0.08, 0.50, COLOR.yellow),
  p(-0.40, 0.10, -0.40, 0.55, 0.06, 0.55, COLOR.dirt),
  p(-0.40, 0.14, -0.40, 0.50, 0.08, 0.50, COLOR.yellow),
  p(0.40, 0.10, 0.40, 0.55, 0.06, 0.55, COLOR.dirt),
  p(0.40, 0.14, 0.40, 0.50, 0.08, 0.50, COLOR.yellow),
  p(0.00, 0.10, -0.74, 0.55, 0.06, 0.20, COLOR.dirt),
  p(0.00, 0.14, -0.74, 0.50, 0.08, 0.16, COLOR.yellow),
  // scarecrow
  p(0.10, 0.30, 0.20, 0.04, 0.36, 0.04, COLOR.wood),
  p(0.10, 0.40, 0.20, 0.22, 0.04, 0.04, COLOR.wood),
  p(0.10, 0.50, 0.20, 0.10, 0.12, 0.10, COLOR.cream),
  p(0.10, 0.59, 0.20, 0.18, 0.04, 0.18, COLOR.brick),
  // wooden fence corners
  p(-0.95, 0.20, -0.95, 0.06, 0.32, 0.06, COLOR.wood),
  p(0.95, 0.20, -0.95, 0.06, 0.32, 0.06, COLOR.wood),
  p(0.95, 0.20, 0.95, 0.06, 0.32, 0.06, COLOR.wood),
  p(-0.95, 0.20, 0.95, 0.06, 0.32, 0.06, COLOR.wood),
];

const BAKERY_PARTS: VoxelPart[] = [
  p(0, 0.08, 0, 0.88, 0.16, 0.88, COLOR.brick),                // brick base
  p(0, 0.45, 0, 0.80, 0.55, 0.80, COLOR.cream),                // upper walls
  p(0, 0.82, 0, 0.92, 0.18, 0.92, COLOR.brick),                // tiled roof
  p(0, 0.96, 0, 0.55, 0.08, 0.55, COLOR.redDark),              // roof cap
  p(0.28, 1.20, -0.28, 0.20, 0.52, 0.20, COLOR.stone),         // tall oven chimney
  p(0.28, 1.50, -0.28, 0.18, 0.10, 0.18, COLOR.smoke),         // smoke puff 1
  p(0.28, 1.62, -0.28, 0.13, 0.10, 0.13, 0x6a6a6a),            // smoke puff 2 lighter
  p(0, 0.30, 0.41, 0.26, 0.40, 0.04, COLOR.woodDark),          // double door
  p(-0.30, 0.65, 0.41, 0.18, 0.16, 0.03, COLOR.windowYellow),  // bread display window
  p(0.30, 0.65, 0.41, 0.18, 0.16, 0.03, COLOR.windowYellow),
  // bread loaves in display
  p(-0.30, 0.55, 0.41, 0.06, 0.04, 0.02, 0xc9a472),
  p(-0.21, 0.55, 0.41, 0.06, 0.04, 0.02, 0xb8895c),
];

const WORKSHOP_PARTS: VoxelPart[] = [
  p(0, 0.10, 0, 0.86, 0.20, 0.86, COLOR.slate),                // stone footing
  p(0, 0.45, 0, 0.80, 0.50, 0.80, COLOR.stoneDark),            // walls
  p(0, 0.75, 0, 0.92, 0.18, 0.92, COLOR.slate),                // roof slab
  p(0, 0.86, 0, 0.55, 0.06, 0.55, 0x2a2e36),                   // roof ridge
  // tall brick chimney with belt
  p(0.30, 1.05, -0.30, 0.22, 0.72, 0.22, COLOR.brick),
  p(0.30, 1.34, -0.30, 0.26, 0.06, 0.26, COLOR.redDark),
  p(0.30, 1.46, -0.30, 0.20, 0.10, 0.20, COLOR.smoke),
  p(0.30, 1.58, -0.30, 0.16, 0.10, 0.16, 0x6a6a6a),
  // forge glow window
  p(-0.25, 0.48, 0.41, 0.22, 0.20, 0.04, COLOR.fireBright),
  // anvil out front
  p(-0.30, 0.18, 0.50, 0.14, 0.10, 0.20, COLOR.stoneDark),
  p(-0.30, 0.24, 0.50, 0.20, 0.04, 0.10, 0x222222),
];

const MARKET_PARTS: VoxelPart[] = [
  p(0, 0.04, 0, 1.7, 0.08, 1.7, COLOR.wood),                   // floor planks
  p(0, 0.09, 0, 1.65, 0.02, 0.10, COLOR.woodDark),             // floor seam
  p(-0.75, 0.45, -0.75, 0.12, 0.85, 0.12, COLOR.wood),         // 4 posts taller
  p(0.75, 0.45, -0.75, 0.12, 0.85, 0.12, COLOR.wood),
  p(-0.75, 0.45, 0.75, 0.12, 0.85, 0.12, COLOR.wood),
  p(0.75, 0.45, 0.75, 0.12, 0.85, 0.12, COLOR.wood),
  // striped tent — alternating red/cream slabs front-to-back
  p(-0.6, 0.92, 0, 0.35, 0.18, 1.65, COLOR.red),
  p(-0.2, 0.92, 0, 0.35, 0.18, 1.65, COLOR.cream),
  p(0.2, 0.92, 0, 0.35, 0.18, 1.65, COLOR.red),
  p(0.6, 0.92, 0, 0.35, 0.18, 1.65, COLOR.cream),
  // ridge
  p(0, 1.08, 0, 1.7, 0.06, 0.18, COLOR.redDark),
  // pennant flag
  p(0, 1.25, -0.75, 0.04, 0.32, 0.04, COLOR.wood),
  p(0.12, 1.4, -0.75, 0.16, 0.12, 0.02, COLOR.yellow),
  // goods crates
  p(-0.35, 0.22, -0.35, 0.3, 0.26, 0.3, COLOR.brick),
  p(0.35, 0.22, 0.25, 0.3, 0.26, 0.3, COLOR.yellow),
  p(0.0, 0.22, 0.45, 0.25, 0.26, 0.25, COLOR.windowBlue),
  // fruit baskets
  p(-0.35, 0.40, 0.35, 0.14, 0.10, 0.14, 0xff8a3a),
  p(0.20, 0.40, -0.40, 0.14, 0.10, 0.14, 0xa6db5a),
];

const SCHOOL_PARTS: VoxelPart[] = [
  p(0, 0.10, 0, 0.92, 0.20, 0.92, COLOR.stone),                // foundation
  p(0, 0.45, 0, 0.85, 0.50, 0.85, COLOR.brick),                // walls
  p(0, 0.78, 0, 0.95, 0.18, 0.95, COLOR.slate),                // hip roof
  // central bell tower
  p(0, 1.05, 0, 0.30, 0.40, 0.30, COLOR.white),                // tower shaft
  p(0, 1.32, 0, 0.20, 0.06, 0.20, COLOR.gold),                 // tower ring
  p(0, 1.42, 0, 0.30, 0.16, 0.30, COLOR.red),                  // bell roof
  p(0, 1.55, 0, 0.06, 0.20, 0.06, COLOR.gold),                 // weather vane
  // big front door + windows
  p(0, 0.28, 0.43, 0.20, 0.32, 0.04, COLOR.woodDark),
  p(-0.30, 0.48, 0.43, 0.16, 0.16, 0.03, COLOR.windowYellow),
  p(0.30, 0.48, 0.43, 0.16, 0.16, 0.03, COLOR.windowYellow),
  // entrance steps
  p(0, 0.22, 0.46, 0.30, 0.06, 0.06, COLOR.stone),
];

const HOSPITAL_PARTS: VoxelPart[] = [
  p(0, 0.10, 0, 1.82, 0.20, 1.82, COLOR.stone),                // base
  p(0, 0.50, 0, 1.70, 0.60, 1.70, COLOR.white),                // main floor
  p(0, 0.92, 0, 1.85, 0.16, 1.85, COLOR.stoneDark),            // roof slab
  // big elevated red cross on roof
  p(0, 1.22, 0, 0.50, 0.16, 0.16, COLOR.red),
  p(0, 1.22, 0, 0.16, 0.16, 0.50, COLOR.red),
  // door + windows
  p(0, 0.32, 0.86, 0.30, 0.50, 0.04, COLOR.windowBlue),
  p(-0.60, 0.62, 0.86, 0.20, 0.20, 0.03, COLOR.windowYellow),
  p(0.60, 0.62, 0.86, 0.20, 0.20, 0.03, COLOR.windowYellow),
  p(-0.60, 0.62, -0.86, 0.20, 0.20, 0.03, COLOR.windowYellow),
  p(0.60, 0.62, -0.86, 0.20, 0.20, 0.03, COLOR.windowYellow),
  // small red cross above main door
  p(0, 0.85, 0.86, 0.16, 0.04, 0.02, COLOR.red),
  p(0, 0.85, 0.86, 0.04, 0.16, 0.02, COLOR.red),
];

const WELL_PARTS: VoxelPart[] = [
  // octagonal-ish stone ring (4 corner stones + 4 side stones)
  p(0, 0.18, 0, 0.5, 0.32, 0.5, COLOR.stoneDark),              // outer stone
  p(0, 0.18, 0, 0.42, 0.32, 0.42, COLOR.stone),                // inner ledge
  p(0, 0.33, 0, 0.36, 0.04, 0.36, COLOR.waterDeep),            // water surface
  // wooden frame
  p(-0.22, 0.62, 0, 0.06, 0.55, 0.06, COLOR.wood),
  p(0.22, 0.62, 0, 0.06, 0.55, 0.06, COLOR.wood),
  p(0, 0.90, 0, 0.55, 0.06, 0.06, COLOR.woodDark),             // cross-beam
  // sloped roof slabs
  p(0, 0.98, 0, 0.60, 0.10, 0.50, COLOR.redDark),
  p(0, 1.06, 0, 0.30, 0.06, 0.32, COLOR.red),
  // bucket on rope
  p(0, 0.72, 0, 0.10, 0.14, 0.10, COLOR.wood),
  p(0, 0.85, 0, 0.02, 0.06, 0.02, COLOR.woodDark),             // rope
];

const BANK_PARTS: VoxelPart[] = [
  p(0, 0.2, 0, 0.8, 0.4, 0.8, COLOR.stoneDark),                // base
  p(0, 0.65, 0, 0.85, 0.5, 0.85, COLOR.white),                 // upper
  p(0, 0.95, 0, 0.95, 0.15, 0.95, COLOR.cream),                // pediment
  // columns (cosmetic)
  p(-0.3, 0.6, 0.43, 0.08, 0.4, 0.08, COLOR.white),
  p(-0.1, 0.6, 0.43, 0.08, 0.4, 0.08, COLOR.white),
  p(0.1, 0.6, 0.43, 0.08, 0.4, 0.08, COLOR.white),
  p(0.3, 0.6, 0.43, 0.08, 0.4, 0.08, COLOR.white),
  p(0, 1.1, 0, 0.1, 0.18, 0.1, COLOR.gold),                    // gold finial
];

const STADIUM_PARTS: VoxelPart[] = [
  p(0, 0.05, 0, 1.7, 0.1, 1.7, COLOR.grass),                   // field
  // stands as a ring of cubes
  p(0, 0.35, -0.85, 1.7, 0.6, 0.2, COLOR.cream),
  p(0, 0.35, 0.85, 1.7, 0.6, 0.2, COLOR.cream),
  p(-0.85, 0.35, 0, 0.2, 0.6, 1.7, COLOR.cream),
  p(0.85, 0.35, 0, 0.2, 0.6, 1.7, COLOR.cream),
  // flag
  p(0, 0.95, -0.85, 0.04, 0.5, 0.04, COLOR.wood),
  p(0.12, 1.05, -0.85, 0.18, 0.15, 0.02, COLOR.red),
];

const PARK_PARTS: VoxelPart[] = [
  p(0, 0.04, 0, 0.92, 0.08, 0.92, COLOR.grassDark),            // patch
  // gravel path crossing
  p(0, 0.085, 0, 0.18, 0.01, 0.92, 0xb8a888),
  p(0, 0.085, 0, 0.92, 0.01, 0.18, 0xb8a888),
  // tree
  p(-0.20, 0.28, -0.20, 0.10, 0.40, 0.10, COLOR.woodDark),
  p(-0.20, 0.66, -0.20, 0.45, 0.40, 0.45, COLOR.forest),
  p(-0.20, 0.88, -0.20, 0.28, 0.18, 0.28, COLOR.forestCanopy),
  // bench (slats + legs)
  p(0.25, 0.18, 0.30, 0.30, 0.04, 0.10, COLOR.wood),
  p(0.25, 0.22, 0.32, 0.30, 0.10, 0.02, COLOR.woodDark),
  p(0.13, 0.10, 0.30, 0.03, 0.16, 0.03, COLOR.woodDark),
  p(0.37, 0.10, 0.30, 0.03, 0.16, 0.03, COLOR.woodDark),
  // colourful flowers
  p(0.30, 0.12, -0.30, 0.06, 0.10, 0.06, 0xff7aa0),
  p(0.40, 0.10, -0.20, 0.05, 0.08, 0.05, 0xffd24a),
  p(0.20, 0.10, -0.20, 0.05, 0.08, 0.05, 0x9ed7ff),
];

const WATCHTOWER_PARTS: VoxelPart[] = [
  p(0, 0.08, 0, 0.55, 0.16, 0.55, COLOR.stoneDark),            // base
  p(0, 0.62, 0, 0.40, 0.92, 0.40, COLOR.stone),                // shaft
  // narrow arrow slits
  p(0, 0.85, 0.21, 0.06, 0.18, 0.02, COLOR.windowYellow),
  p(0.21, 0.85, 0, 0.02, 0.18, 0.06, COLOR.windowYellow),
  p(-0.21, 0.85, 0, 0.02, 0.18, 0.06, COLOR.windowYellow),
  p(0, 1.18, 0, 0.58, 0.10, 0.58, COLOR.stoneDark),            // platform
  // battlements / merlons — 4 corners
  p(-0.25, 1.30, -0.25, 0.10, 0.16, 0.10, COLOR.stone),
  p(0.25, 1.30, -0.25, 0.10, 0.16, 0.10, COLOR.stone),
  p(-0.25, 1.30, 0.25, 0.10, 0.16, 0.10, COLOR.stone),
  p(0.25, 1.30, 0.25, 0.10, 0.16, 0.10, COLOR.stone),
  // flag pole + banner
  p(0, 1.55, 0, 0.04, 0.40, 0.04, COLOR.wood),
  p(0.12, 1.66, 0, 0.18, 0.14, 0.02, COLOR.red),
];

const FIRE_STATION_PARTS: VoxelPart[] = [
  p(0, 0.10, 0, 0.86, 0.20, 0.86, COLOR.redDark),              // base
  p(0, 0.45, 0, 0.80, 0.50, 0.80, COLOR.red),                  // walls
  p(0, 0.78, 0, 0.92, 0.16, 0.92, COLOR.redDark),              // roof
  // bell tower
  p(0.25, 1.00, -0.25, 0.20, 0.45, 0.20, COLOR.white),
  p(0.25, 1.28, -0.25, 0.26, 0.10, 0.26, COLOR.redDark),       // bell roof
  p(0.25, 1.20, -0.25, 0.16, 0.10, 0.16, COLOR.gold),          // bell body
  // big garage door
  p(0, 0.28, 0.43, 0.50, 0.42, 0.04, COLOR.stoneDark),
  p(0, 0.28, 0.45, 0.46, 0.02, 0.02, COLOR.yellow),            // stripe
  p(0, 0.40, 0.45, 0.46, 0.02, 0.02, COLOR.yellow),
  // hose reel on side wall
  p(-0.41, 0.45, 0.20, 0.04, 0.16, 0.16, COLOR.stoneDark),
];

// Note: the yellow stripe is drawn by world/RoadOverlay.ts based on the
// connectivity of each road tile to its 4-neighbours.  Keep this mesh
// just the slab.
const ROAD_PARTS: VoxelPart[] = [
  p(0, 0.025, 0, 0.96, 0.05, 0.96, COLOR.stoneDark),
  p(0, 0.05, 0, 0.86, 0.005, 0.86, 0x3a3e48),     // worn inner patch
];

const WONDER_PARTS: VoxelPart[] = [
  // grand staircase up to base
  p(0, 0.10, 1.20, 1.60, 0.20, 0.20, COLOR.stone),
  p(0, 0.25, 1.30, 1.20, 0.12, 0.12, COLOR.cream),
  // base plaza
  p(0, 0.45, 0, 2.80, 0.30, 2.80, COLOR.cream),
  p(0, 0.55, 0, 2.60, 0.06, 2.60, COLOR.tan),                   // trim
  // 3-tier ziggurat
  p(0, 0.92, 0, 2.30, 0.65, 2.30, COLOR.cream),
  p(0, 1.45, 0, 1.80, 0.50, 1.80, COLOR.tan),
  p(0, 1.90, 0, 1.30, 0.40, 1.30, COLOR.brick),
  p(0, 2.25, 0, 0.85, 0.30, 0.85, COLOR.gold),                  // gold platform
  p(0, 2.55, 0, 0.45, 0.30, 0.45, COLOR.gold),                  // upper gold
  p(0, 2.95, 0, 0.18, 0.50, 0.18, COLOR.gold),                  // spire
  p(0, 3.25, 0, 0.36, 0.10, 0.36, COLOR.gold),                  // sun disk
  // corner columns
  p(-1.20, 0.85, -1.20, 0.20, 1.15, 0.20, COLOR.white),
  p(1.20, 0.85, -1.20, 0.20, 1.15, 0.20, COLOR.white),
  p(-1.20, 0.85, 1.20, 0.20, 1.15, 0.20, COLOR.white),
  p(1.20, 0.85, 1.20, 0.20, 1.15, 0.20, COLOR.white),
  // column caps
  p(-1.20, 1.48, -1.20, 0.28, 0.10, 0.28, COLOR.gold),
  p(1.20, 1.48, -1.20, 0.28, 0.10, 0.28, COLOR.gold),
  p(-1.20, 1.48, 1.20, 0.28, 0.10, 0.28, COLOR.gold),
  p(1.20, 1.48, 1.20, 0.28, 0.10, 0.28, COLOR.gold),
  // braziers
  p(-1.20, 1.62, -1.20, 0.16, 0.10, 0.16, COLOR.fireBright),
  p(1.20, 1.62, -1.20, 0.16, 0.10, 0.16, COLOR.fireBright),
  p(-1.20, 1.62, 1.20, 0.16, 0.10, 0.16, COLOR.fireBright),
  p(1.20, 1.62, 1.20, 0.16, 0.10, 0.16, COLOR.fireBright),
];

// ============================================================================
// Catalogue
// ============================================================================

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  house: {
    id: 'house', name: 'House', footprint: 1, tier: 0,
    cost: { wood: 10, stone: 0, coins: 0 }, upkeep: 0, jobs: 0, housing: 4,
    parts: HOUSE_PARTS, needsRoad: false,
    desc: 'Houses 4 citizens. The backbone of every city.',
  },
  cottage: {
    id: 'cottage', name: 'Cottage', footprint: 1, tier: 25,
    cost: { wood: 15, stone: 10, coins: 5 }, upkeep: 0, jobs: 0, housing: 8,
    parts: COTTAGE_PARTS, needsRoad: false,
    service: { kind: 'happiness', radius: 2, strength: 1 },
    desc: 'Roomier home. +1 happiness aura.',
  },
  tenement: {
    id: 'tenement', name: 'Tenement', footprint: 2, tier: 150,
    cost: { wood: 25, stone: 25, coins: 15 }, upkeep: 1, jobs: 0, housing: 24,
    parts: TENEMENT_PARTS, needsRoad: false,
    service: { kind: 'happiness', radius: 2, strength: -1 },
    desc: 'Dense housing. -1 happiness aura. Plague risk.',
  },
  forester: {
    id: 'forester', name: 'Forester', footprint: 1, tier: 0,
    cost: { wood: 10, stone: 0, coins: 0 }, upkeep: 0, jobs: 2, housing: 0,
    parts: FORESTER_PARTS, needsRoad: true,
    produces: { out: 'wood', perTick: 2, needsBiome: 'forest', needsBiomeRange: 3 },
    desc: 'Harvests wood. Needs forest within 3 tiles.',
  },
  quarry: {
    id: 'quarry', name: 'Quarry', footprint: 2, tier: 25,
    cost: { wood: 10, stone: 0, coins: 10 }, upkeep: 1, jobs: 3, housing: 0,
    parts: QUARRY_PARTS, needsRoad: true,
    produces: { out: 'stone', perTick: 2, needsBiome: 'hill', needsBiomeRange: 3 },
    desc: 'Mines stone. Needs hill within 3 tiles.',
  },
  farm: {
    id: 'farm', name: 'Farm', footprint: 2, tier: 0,
    cost: { wood: 15, stone: 0, coins: 0 }, upkeep: 0, jobs: 3, housing: 0,
    parts: FARM_PARTS, needsRoad: true,
    produces: { out: 'wheat', perTick: 3, needsBiome: 'grass' },
    desc: 'Grows wheat on grass tiles.',
  },
  bakery: {
    id: 'bakery', name: 'Bakery', footprint: 1, tier: 25,
    cost: { wood: 10, stone: 10, coins: 5 }, upkeep: 1, jobs: 2, housing: 0,
    parts: BAKERY_PARTS, needsRoad: true,
    produces: { out: 'food', perTick: 3, consume: { wheat: 2 } },
    desc: 'Wheat → food.',
  },
  workshop: {
    id: 'workshop', name: 'Workshop', footprint: 1, tier: 75,
    cost: { wood: 15, stone: 15, coins: 10 }, upkeep: 1, jobs: 3, housing: 0,
    parts: WORKSHOP_PARTS, needsRoad: true,
    produces: { out: 'goods', perTick: 2, consume: { wood: 1, stone: 1 } },
    desc: 'Wood + stone → goods. School boosts output.',
  },
  market: {
    id: 'market', name: 'Market', footprint: 2, tier: 25,
    cost: { wood: 15, stone: 10, coins: 10 }, upkeep: 1, jobs: 2, housing: 0,
    parts: MARKET_PARTS, needsRoad: true,
    produces: { out: 'coins', perTick: 5, consume: { food: 1, goods: 1 } },
    desc: 'Sells food + goods → coins.',
  },
  school: {
    id: 'school', name: 'School', footprint: 1, tier: 75,
    cost: { wood: 10, stone: 15, coins: 15 }, upkeep: 2, jobs: 2, housing: 0,
    parts: SCHOOL_PARTS, needsRoad: true,
    service: { kind: 'school', radius: 4, strength: 1 },
    desc: '+1 happiness r=4. Boosts Workshop output.',
  },
  hospital: {
    id: 'hospital', name: 'Hospital', footprint: 2, tier: 150,
    cost: { wood: 20, stone: 25, coins: 25 }, upkeep: 3, jobs: 4, housing: 0,
    parts: HOSPITAL_PARTS, needsRoad: true,
    service: { kind: 'cure', radius: 5, strength: 1 },
    desc: 'Cures plague within range.',
  },
  well: {
    id: 'well', name: 'Well', footprint: 1, tier: 0,
    cost: { wood: 5, stone: 10, coins: 0 }, upkeep: 0, jobs: 0, housing: 0,
    parts: WELL_PARTS, needsRoad: false,
    service: { kind: 'water', radius: 4, strength: 1 },
    desc: 'Provides water service. Prevents plague.',
  },
  bank: {
    id: 'bank', name: 'Bank', footprint: 1, tier: 150,
    cost: { wood: 0, stone: 25, coins: 25 }, upkeep: 0, jobs: 2, housing: 0,
    parts: BANK_PARTS, needsRoad: true,
    service: { kind: 'bank', radius: 5, strength: 1 },
    produces: { out: 'coins', perTick: 10 },
    desc: '+10 coins/tick. Boosts adjacent Markets.',
  },
  stadium: {
    id: 'stadium', name: 'Stadium', footprint: 2, tier: 150,
    cost: { wood: 25, stone: 25, coins: 25 }, upkeep: 3, jobs: 3, housing: 0,
    parts: STADIUM_PARTS, needsRoad: true,
    service: { kind: 'happiness', radius: 6, strength: 3 },
    desc: '+3 happiness r=6.',
  },
  park: {
    id: 'park', name: 'Park', footprint: 1, tier: 25,
    cost: { wood: 5, stone: 5, coins: 5 }, upkeep: 0, jobs: 0, housing: 0,
    parts: PARK_PARTS, needsRoad: false,
    service: { kind: 'happiness', radius: 3, strength: 1 },
    desc: '+1 happiness r=3.',
  },
  watchtower: {
    id: 'watchtower', name: 'Tower', footprint: 1, tier: 75,
    cost: { wood: 10, stone: 15, coins: 10 }, upkeep: 1, jobs: 1, housing: 0,
    parts: WATCHTOWER_PARTS, needsRoad: false,
    service: { kind: 'safety', radius: 5, strength: 1 },
    desc: 'Blocks bandit raids within range.',
  },
  fireStation: {
    id: 'fireStation', name: 'Fire Hall', footprint: 1, tier: 25,
    cost: { wood: 10, stone: 15, coins: 10 }, upkeep: 1, jobs: 2, housing: 0,
    parts: FIRE_STATION_PARTS, needsRoad: true,
    service: { kind: 'fire', radius: 4, strength: 1 },
    desc: 'Prevents and extinguishes fires.',
  },
  road: {
    id: 'road', name: 'Road', footprint: 1, tier: 0,
    cost: { wood: 5, stone: 0, coins: 0 }, upkeep: 0, jobs: 0, housing: 0,
    parts: ROAD_PARTS, needsRoad: false,
    desc: 'Connects producers. +10% to long runs.',
  },
  wonder: {
    id: 'wonder', name: 'Wonder', footprint: 3, tier: 250,
    cost: { wood: 200, stone: 200, coins: 200 }, upkeep: 0, jobs: 0, housing: 0,
    parts: WONDER_PARTS, needsRoad: false,
    desc: 'Build to win the game. Takes 30s.',
  },
};

export function paletteSwatch(t: BuildingType): number {
  // representative color for menu chip
  switch (t) {
    case 'house': case 'cottage': return COLOR.cream;
    case 'tenement': return COLOR.stoneDark;
    case 'forester': return COLOR.woodDark;
    case 'quarry': return COLOR.stone;
    case 'farm': return COLOR.yellow;
    case 'bakery': return COLOR.brick;
    case 'workshop': return COLOR.slate;
    case 'market': return COLOR.red;
    case 'school': return COLOR.brick;
    case 'hospital': return COLOR.white;
    case 'well': return COLOR.water;
    case 'bank': return COLOR.gold;
    case 'stadium': return COLOR.grass;
    case 'park': return COLOR.grassDark;
    case 'watchtower': return COLOR.stone;
    case 'fireStation': return COLOR.red;
    case 'road': return COLOR.stoneDark;
    case 'wonder': return COLOR.gold;
  }
}
