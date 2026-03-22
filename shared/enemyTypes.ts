/**
 * enemyTypes.ts — shared/enemyTypes.ts
 * ──────────────────────────────────────
 * Config-driven enemy type registry used by both the server (spawning,
 * AI, damage) and the client (rendering, health-bar sizing).
 *
 * To add a new enemy type:
 *   1. Add an entry to ENEMY_TYPES below
 *   2. No other files need changing — spawn / AI / render all key off this
 */

export type EnemyTypeId = "slime" | "fastSlime" | "brute";

export interface EnemyTypeDef {
  /** Display / texture key used by client */
  sprite:        string;
  hp:            number;
  /** px/sec */
  speed:         number;
  /** Pixel radius for collision (orbit hit detection) */
  radius:        number;
  /** Total XP reward; split across multiple orbs on death */
  xpReward:      number;
  /** How many orbs to split the reward into */
  xpOrbCount:    number;
  /** Aggro range — enemy switches from idle to chasing when player enters */
  aggroRadius:   number;
  /** RGB hex tint used for the placeholder circle */
  tint:          number;
}

export const ENEMY_TYPES: Record<EnemyTypeId, EnemyTypeDef> = {
  slime: {
    sprite:      "enemy_slime",
    hp:          40,
    speed:       75,
    radius:      18,
    xpReward:    20,
    xpOrbCount:  3,
    aggroRadius: 400,
    tint:        0xff3333,
  },
  fastSlime: {
    sprite:      "enemy_fastSlime",
    hp:          20,
    speed:       140,
    radius:      14,
    xpReward:    15,
    xpOrbCount:  2,
    aggroRadius: 500,
    tint:        0xff8800,
  },
  brute: {
    sprite:      "enemy_brute",
    hp:          120,
    speed:       45,
    radius:      28,
    xpReward:    60,
    xpOrbCount:  6,
    aggroRadius: 300,
    tint:        0xcc00ff,
  },
};

/** Weighted spawn pool — tune frequency by repeating entries */
export const SPAWN_POOL: EnemyTypeId[] = [
  "slime", "slime", "slime",
  "fastSlime", "fastSlime",
  "brute",
];
