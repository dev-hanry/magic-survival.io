import { ArenaState }  from "../schema/ArenaState";
import { EnemySchema } from "../schema/EnemySchema";
import { ENEMY_TYPES, EnemyTypeId } from "../../../shared/enemyTypes";

/**
 * EnemyAISystem
 * ──────────────
 * Server-authoritative enemy behaviour FSM.
 *
 * States
 * ──────
 *   idle     → wander slowly; scan for players within aggroRadius
 *   chasing  → move toward targetPlayer at full speed
 *   attacking → (placeholder) — enemy is within melee range
 *
 * All movement is applied directly to schema fields; Colyseus will
 * diff and broadcast only the changed x/y each tick.
 */
export class EnemyAISystem {
  // Per-enemy wander timer so they don't all move in sync
  private wanderTimers = new Map<string, number>();
  private wanderAngles = new Map<string, number>();

  update(state: ArenaState, deltaMs: number): void {
    const dt = deltaMs / 1000;

    state.enemies.forEach((enemy) => {
      if (enemy.dead) return;

      const def = ENEMY_TYPES[enemy.type as EnemyTypeId];

      // ── Find closest player ──────────────────────────────────────
      let closestId   = "";
      let closestDist = Infinity;

      state.players.forEach((player, pid) => {
        const d = dist(enemy.x, enemy.y, player.x, player.y);
        if (d < closestDist) { closestDist = d; closestId = pid; }
      });

      // ── State transitions ────────────────────────────────────────
      if (closestId && closestDist <= def.aggroRadius) {
        enemy.state          = "chasing";
        enemy.targetPlayerId = closestId;
      } else if (enemy.state === "chasing" && closestDist > def.aggroRadius * 1.3) {
        // Hysteresis: don't immediately de-aggro at boundary
        enemy.state          = "idle";
        enemy.targetPlayerId = "";
      }

      // ── Movement ────────────────────────────────────────────────
      if (enemy.state === "chasing") {
        const target = state.players.get(enemy.targetPlayerId);
        if (target) {
          const dx = target.x - enemy.x;
          const dy = target.y - enemy.y;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          enemy.x  = clamp(enemy.x + (dx / d) * def.speed * dt, 0, 4000);
          enemy.y  = clamp(enemy.y + (dy / d) * def.speed * dt, 0, 4000);
        }
      } else {
        // Idle wander: change direction every 2–4 seconds
        const timer = (this.wanderTimers.get(enemy.id) ?? 0) - deltaMs;
        if (timer <= 0) {
          this.wanderTimers.set(enemy.id, 2000 + Math.random() * 2000);
          this.wanderAngles.set(enemy.id, Math.random() * Math.PI * 2);
        } else {
          this.wanderTimers.set(enemy.id, timer);
        }

        const angle   = this.wanderAngles.get(enemy.id) ?? 0;
        const wSpeed  = def.speed * 0.3;
        enemy.x = clamp(enemy.x + Math.cos(angle) * wSpeed * dt, 0, 4000);
        enemy.y = clamp(enemy.y + Math.sin(angle) * wSpeed * dt, 0, 4000);
      }
    });
  }

  /** Clean up timers when an enemy is removed */
  removeEnemy(id: string): void {
    this.wanderTimers.delete(id);
    this.wanderAngles.delete(id);
  }
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
