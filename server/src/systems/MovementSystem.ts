import { ArenaState }                          from "../schema/ArenaState";
import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS } from "../../../shared/constants";

/**
 * Server-authoritative movement system.
 *
 * Called every server tick (50 ms / 20 Hz).
 * Reads each player's stored inputDx/Dy, normalises diagonal movement,
 * clamps to world bounds, and writes the new position back into the schema.
 * Colyseus will automatically delta-broadcast the change to all clients.
 */
export class MovementSystem {
  update(state: ArenaState, deltaMs: number): void {
    const dt = deltaMs / 1000; // convert to seconds

    state.players.forEach((player) => {
      const dx = player.inputDx;
      const dy = player.inputDy;
      if (dx === 0 && dy === 0) return;

      // Normalise so diagonal movement isn't faster
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx  = dx / len;
      const ny  = dy / len;

      player.x = clamp(
        player.x + nx * player.speed * dt,
        PLAYER_RADIUS,
        WORLD_WIDTH  - PLAYER_RADIUS
      );
      player.y = clamp(
        player.y + ny * player.speed * dt,
        PLAYER_RADIUS,
        WORLD_HEIGHT - PLAYER_RADIUS
      );
    });
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
