// ─────────────────────────────────────────────
//  Shared constants — imported by client & server
// ─────────────────────────────────────────────

export const WORLD_WIDTH   = 4000;
export const WORLD_HEIGHT  = 4000;

export const TICK_RATE     = 20;          // server ticks/sec
export const PLAYER_SPEED  = 220;         // px/sec
export const PLAYER_RADIUS = 16;

export const XP_ORB_RADIUS   = 8;
export const XP_ORB_COUNT    = 120;       // orbs alive in world at once
export const PICKUP_RADIUS   = 65;        // default magnet radius

export const VISIBILITY_RADIUS = 1200;    // only sync entities within this range

export const BASE_XP              = 40;   // xp needed for level 2
export const XP_LEVEL_MULTIPLIER  = 1.5;  // each level needs 1.5× more

export const ORBIT_RADIUS = 65;
export const ORBIT_SPEED  = 2.2;          // rad/sec
export const ORBIT_DAMAGE = 10;

export const SERVER_URL = "ws://localhost:2567";
