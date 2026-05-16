// Gameplay tuning constants. Flagged in the design doc as the numbers most
// likely to need playtest. Tweak here, not in systems.

export const STARTING_RESOURCES = {
  wood: 60,
  stone: 20,
  food: 80,
  coins: 50,
  wheat: 0,
  goods: 0,
};

// --- Population ---
export const CITIZEN_SPAWN_INTERVAL_TICKS = 16;      // ~4s between births
export const HAPPINESS_SPAWN_THRESHOLD = 40;
export const HAPPINESS_MIGRATION_THRESHOLD = 25;
export const STARVATION_RATE = 1;                    // pop lost per tick when food < 0
export const FOOD_PER_POP_PER_TICK = 0.06;           // city consumes pop*this per tick

// --- Production ---
export const PRODUCTION_INTERVAL_TICKS = 4;          // production every N ticks
export const FORESTER_WOOD_PER_TICK = 2;
export const QUARRY_STONE_PER_TICK = 2;
export const FARM_WHEAT_PER_TICK = 3;
export const BAKERY_FOOD_PER_TICK = 3;
export const BAKERY_WHEAT_COST = 2;
export const WORKSHOP_GOODS_PER_TICK = 2;
export const WORKSHOP_WOOD_COST = 1;
export const WORKSHOP_STONE_COST = 1;
export const MARKET_COINS_PER_TICK = 5;
export const BANK_COINS_PER_TICK = 10;
export const ROAD_BONUS_LENGTH = 3;
export const ROAD_BONUS_PCT = 0.10;
export const SCHOOL_WORKSHOP_BONUS_PCT = 0.25;

// --- Disasters ---
export const DISASTER_GRACE_TICKS = 480;             // no disasters in first ~2 min
export const FIRE_IGNITION_BASE = 0.0002;            // per residential/workshop per tick
export const FIRE_IGNITION_UNCOVERED_MULT = 2;
export const FIRE_IGNITION_COVERED_MULT = 0.2;
export const FIRE_SPREAD_CHANCE = 0.25;
export const FIRE_SPREAD_INTERVAL_TICKS = 4;
export const FIRE_BURN_TICKS = 24;
export const FIRE_EXTINGUISH_TICKS = 10;
export const RAIN_FIRE_MULT = 0.3;
export const STORM_LIGHTNING_CHANCE = 0.008;          // per tick during storm

export const PLAGUE_CHECK_INTERVAL_TICKS = 16;
export const PLAGUE_DENSITY_THRESHOLD = 6;           // houses in 5x5
export const PLAGUE_WELL_COVERAGE_MIN = 0.5;
export const PLAGUE_ROLL = 0.005;
export const PLAGUE_DURATION_TICKS = 80;
export const PLAGUE_POP_LOSS_INTERVAL_TICKS = 8;
export const PLAGUE_HOSPITAL_CURE_TICKS = 40;
export const PLAGUE_HAPPINESS_DROP = 20;

export const RAID_INTERVAL_TICKS = 240;
export const RAID_TELEGRAPH_TICKS = 16;
export const RAID_EDGE_RANGE = 3;
export const RAID_MIN_POP = 75;

// --- Day/night & weather ---
export const DAY_CYCLE_TICKS = 480;                  // full day = 2 min
export const WEATHER_CYCLE_TICKS = 360;              // weather changes every 90s

// --- Wonder ---
export const WONDER_BUILD_TICKS = 120;
export const WONDER_DRAIN_COINS_PER_TICK = 5;
export const WONDER_DISASTER_MULT = 1.5;
