import { ArenaState }   from "../schema/ArenaState";
import { EnemySchema }  from "../schema/EnemySchema";
import { ENEMY_TYPES, SPAWN_POOL, EnemyTypeId } from "../../../shared/enemyTypes";

/** Tune all spawn behaviour here */
const SPAWN_CONFIG = {
  maxEnemies:      40,    // hard cap — server won't spawn past this
  spawnInterval:   3000,  // ms between spawn waves
  spawnPerWave:    3,     // enemies added per wave
  spawnRadiusMin:  300,   // min distance from target player (px)
  spawnRadiusMax:  700,   // max distance
};

/**
 * EnemySpawnSystem
 * ─────────────────
 * Runs on the server tick loop. Every `spawnInterval` ms it picks a random
 * active player and spawns `spawnPerWave` enemies in a ring around them.
 *
 * Enemy type is drawn from the weighted SPAWN_POOL in enemyTypes.ts.
 * All numeric defaults come from ENEMY_TYPES config — nothing hardcoded here.
 */
export class EnemySpawnSystem {
  private enemyCounter  = 0;
  private timeSinceLast = 0;

  update(state: ArenaState, deltaMs: number): void {
    this.timeSinceLast += deltaMs;
    if (this.timeSinceLast < SPAWN_CONFIG.spawnInterval) return;
    this.timeSinceLast = 0;

    // Need at least one player online
    const playerIds = Array.from(state.players.keys());
    if (playerIds.length === 0) return;

    const currentCount = state.enemies.size;
    if (currentCount >= SPAWN_CONFIG.maxEnemies) return;

    const toSpawn = Math.min(
      SPAWN_CONFIG.spawnPerWave,
      SPAWN_CONFIG.maxEnemies - currentCount
    );

    for (let i = 0; i < toSpawn; i++) {
      // Pick a random player as the spawn anchor
      const anchorId = playerIds[Math.floor(Math.random() * playerIds.length)];
      const anchor   = state.players.get(anchorId)!;

      const typeId   = SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)] as EnemyTypeId;
      const def      = ENEMY_TYPES[typeId];

      // Random point in annular ring around anchor player
      const angle    = Math.random() * Math.PI * 2;
      const dist     = SPAWN_CONFIG.spawnRadiusMin
                     + Math.random() * (SPAWN_CONFIG.spawnRadiusMax - SPAWN_CONFIG.spawnRadiusMin);

      const enemy         = new EnemySchema();
      enemy.id            = `enemy_${this.enemyCounter++}`;
      enemy.type          = typeId;
      enemy.x             = clamp(anchor.x + Math.cos(angle) * dist, 0, 4000);
      enemy.y             = clamp(anchor.y + Math.sin(angle) * dist, 0, 4000);
      enemy.hp            = def.hp;
      enemy.maxHp         = def.hp;
      enemy.state         = "idle";
      enemy.targetPlayerId = "";
      enemy.dead          = false;

      state.enemies.set(enemy.id, enemy);
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
