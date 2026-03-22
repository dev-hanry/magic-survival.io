import { ArenaState }    from "../schema/ArenaState";
import { XPOrbSchema }  from "../schema/XPOrbSchema";
import {
  BASE_XP,
  XP_LEVEL_MULTIPLIER,
  XP_ORB_COUNT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from "../../../shared/constants";

type LevelUpCallback = (playerId: string, newLevel: number) => void;

/**
 * Handles XP-orb lifecycle (spawn, collection, respawn)
 * and player XP / levelling logic.
 *
 * Design notes
 * ─────────────
 * • Orbs are marked `collected` (not immediately removed) so the client
 *   can play its pickup animation before the object disappears.
 * • One replacement orb is spawned immediately to maintain world density.
 * • xpRequired = BASE_XP × MULTIPLIER^(level-1)   (exponential scaling)
 */
export class XPSystem {
  private orbCounter = 0;

  // ─── Initialisation ──────────────────────────────────────────────────

  spawnInitialOrbs(state: ArenaState): void {
    for (let i = 0; i < XP_ORB_COUNT; i++) {
      this.spawnOrb(state);
    }
  }

  // ─── Per-tick update ─────────────────────────────────────────────────

  update(state: ArenaState, onLevelUp: LevelUpCallback): void {
    const toRemove: string[] = [];

    state.players.forEach((player) => {
      state.xpOrbs.forEach((orb, orbId) => {
        if (orb.collected) return;

        const dx   = player.x - orb.x;
        const dy   = player.y - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.pickupRadius) {
          orb.collected = true;          // client can play pickup FX
          toRemove.push(orbId);

          player.xp += orb.value;

          // Level-up check
          const required = this.xpRequired(player.level);
          if (player.xp >= required) {
            player.xp   -= required;
            player.level += 1;
            onLevelUp(player.id, player.level);
          }
        }
      });
    });

    // Remove + respawn collected orbs in one pass
    toRemove.forEach((id) => {
      state.xpOrbs.delete(id);
      this.spawnOrb(state); // maintain density
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  xpRequired(level: number): number {
    return Math.floor(BASE_XP * Math.pow(XP_LEVEL_MULTIPLIER, level - 1));
  }

  private spawnOrb(state: ArenaState): void {
    const orb   = new XPOrbSchema();
    orb.id      = `orb_${this.orbCounter++}`;
    orb.x       = Math.random() * WORLD_WIDTH;
    orb.y       = Math.random() * WORLD_HEIGHT;
    orb.value   = randomInt(5, 15);
    state.xpOrbs.set(orb.id, orb);
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
