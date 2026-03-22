import { ArenaState }  from "../schema/ArenaState";
import { EnemySchema } from "../schema/EnemySchema";
import { XPOrbSchema } from "../schema/XPOrbSchema";
import { ENEMY_TYPES, EnemyTypeId } from "../../../shared/enemyTypes";
import { HitEvent }    from "../../../shared/types";

/** ms before the same enemy can be hit by the same orbit object again */
const HIT_COOLDOWN_MS = 200;

/** Orbit weapon physical radius used for hit detection */
const ORBIT_WEAPON_RADIUS = 10;

/**
 * EnemyDamageSystem
 * ──────────────────
 * Runs entirely on the server. Each tick it:
 *   1. Advances a per-player orbit angle
 *   2. Computes world-space positions of all orbit weapons
 *   3. Checks each orbit position against each enemy's radius
 *   4. Applies damage respecting per-enemy per-slot cooldowns
 *   5. Marks dead enemies and spawns XP orbs
 *
 * Returns an array of HitEvents so ArenaRoom can broadcast them
 * to clients for floating damage numbers.
 */
export class EnemyDamageSystem {
  // Server-side orbit angle per player (not synced — only used for hit detection)
  private orbitAngles  = new Map<string, number>();

  // Cooldown table: "enemyId:orbitSlot" → timestamp of last hit
  private hitCooldowns = new Map<string, number>();

  // Counter for dropped orb IDs
  private dropCounter  = 0;

  update(
    state:   ArenaState,
    deltaMs: number,
    now:     number,
  ): HitEvent[] {
    const dt     = deltaMs / 1000;
    const hits: HitEvent[] = [];

    // Advance all player orbit angles
    state.players.forEach((player, pid) => {
      const prev = this.orbitAngles.get(pid) ?? Math.random() * Math.PI * 2;
      this.orbitAngles.set(pid, prev + player.orbitSpeed * dt);
    });

    const toKill: EnemySchema[] = [];

    state.enemies.forEach((enemy) => {
      if (enemy.dead) return;

      const def      = ENEMY_TYPES[enemy.type as EnemyTypeId];
      const hitRange = def.radius + ORBIT_WEAPON_RADIUS;

      // Check every player's orbit weapons
      state.players.forEach((player, pid) => {
        const baseAngle  = this.orbitAngles.get(pid) ?? 0;
        const step       = (Math.PI * 2) / player.orbitCount;

        for (let slot = 0; slot < player.orbitCount; slot++) {
          const a   = baseAngle + step * slot;
          const wx  = player.x + Math.cos(a) * player.orbitRadius;
          const wy  = player.y + Math.sin(a) * player.orbitRadius;

          const dx  = wx - enemy.x;
          const dy  = wy - enemy.y;
          const d   = Math.sqrt(dx * dx + dy * dy);

          if (d > hitRange) continue;

          // Check cooldown for this specific orbit slot vs this enemy
          const coolKey = `${enemy.id}:${pid}:${slot}`;
          const lastHit = this.hitCooldowns.get(coolKey) ?? 0;
          if (now - lastHit < HIT_COOLDOWN_MS) continue;

          this.hitCooldowns.set(coolKey, now);

          const damage = 10; // base orbit damage (could be on player schema later)
          enemy.hp     = Math.max(0, enemy.hp - damage);

          hits.push({ enemyId: enemy.id, damage, x: enemy.x, y: enemy.y });

          if (enemy.hp <= 0 && !enemy.dead) {
            enemy.dead = true;
            toKill.push(enemy);
          }
        }
      });
    });

    // Process deaths after iteration to avoid mutation mid-loop
    toKill.forEach((enemy) => this.killEnemy(enemy, state));

    // Prune stale cooldown entries (enemies that no longer exist)
    if (Math.random() < 0.01) this.pruneDeadCooldowns(state);

    return hits;
  }

  // ─── Death & XP drop ─────────────────────────────────────────────────

  private killEnemy(enemy: EnemySchema, state: ArenaState): void {
    const def       = ENEMY_TYPES[enemy.type as EnemyTypeId];
    const valueEach = Math.ceil(def.xpReward / def.xpOrbCount);

    for (let i = 0; i < def.xpOrbCount; i++) {
      const orb   = new XPOrbSchema();
      orb.id      = `drop_${this.dropCounter++}`;
      // Scatter drops in a small radius around death position
      const angle = (Math.PI * 2 / def.xpOrbCount) * i;
      orb.x       = enemy.x + Math.cos(angle) * 20;
      orb.y       = enemy.y + Math.sin(angle) * 20;
      orb.value   = valueEach;
      state.xpOrbs.set(orb.id, orb);
    }

    // Brief delay before removal so client can play death animation.
    // We can't use setTimeout inside a synchronous Colyseus tick, so we
    // rely on the room calling deleteDeadEnemies() one tick later.
  }

  /**
   * Call this from ArenaRoom.tick() every frame.
   * Removes enemies that were marked dead last tick so the client had
   * at least one frame to see the `dead: true` state.
   */
  deleteDeadEnemies(state: ArenaState, aiSystem: { removeEnemy(id: string): void }): void {
    const toRemove: string[] = [];
    state.enemies.forEach((enemy, id) => {
      if (enemy.dead) toRemove.push(id);
    });
    toRemove.forEach((id) => {
      state.enemies.delete(id);
      aiSystem.removeEnemy(id);
    });
  }

  // ─── Cleanup helpers ─────────────────────────────────────────────────

  removePlayer(pid: string): void {
    this.orbitAngles.delete(pid);
  }

  private pruneDeadCooldowns(state: ArenaState): void {
    const alive = new Set(state.enemies.keys());
    for (const key of this.hitCooldowns.keys()) {
      const enemyId = key.split(":")[0];
      if (!alive.has(enemyId)) this.hitCooldowns.delete(key);
    }
  }
}
