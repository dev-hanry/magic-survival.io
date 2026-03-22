import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS } from "@shared/constants";

/**
 * PredictionSystem
 * ─────────────────
 * Implements client-side prediction and server reconciliation for the
 * local player's movement.
 *
 * Flow each frame:
 *   1. Client reads input (dx, dy, seq)
 *   2. Client calls record() to push to the history buffer
 *   3. Client immediately moves the player locally (predict)
 *   4. Server receives input, processes it, sends positionAck {x, y, lastSeq}
 *   5. Client calls reconcile() with the ack — this rewinds to the
 *      server position then fast-forwards by replaying all inputs
 *      with seq > lastSeq. The result is a corrected predicted position.
 *
 * The math in applyStep() MUST stay identical to the server's MovementSystem
 * so prediction errors only come from latency, not computation mismatch.
 */

const HISTORY_SIZE = 120; // ~2 s at 60 fps — plenty of buffer for any RTT

/** One record in the input history ring buffer */
interface InputRecord {
  seq:  number;
  dx:   number;
  dy:   number;
  dt:   number;   // delta time in SECONDS for this frame
}

export class PredictionSystem {
  /** Ring buffer of recent inputs — oldest at index 0 */
  private history: InputRecord[] = [];

  // ─── Write ───────────────────────────────────────────────────────────

  /**
   * Call this every time the local player sends input.
   * Stores the input so it can be replayed during reconciliation.
   */
  record(seq: number, dx: number, dy: number, dtMs: number): void {
    this.history.push({ seq, dx, dy, dt: dtMs / 1000 });
    // Keep buffer bounded — trim oldest entries
    if (this.history.length > HISTORY_SIZE) {
      this.history.shift();
    }
  }

  // ─── Pure movement step — mirrors server MovementSystem exactly ───────

  /**
   * Applies one frame of movement to (x, y) and returns the new position.
   * Keeps the exact same normalisation + world-clamp logic as the server.
   */
  applyStep(
    x: number, y: number,
    dx: number, dy: number,
    dt: number, speed: number,
  ): { x: number; y: number } {
    if (dx === 0 && dy === 0) return { x, y };

    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx  = dx / len;
    const ny  = dy / len;

    return {
      x: clamp(x + nx * speed * dt, PLAYER_RADIUS, WORLD_WIDTH  - PLAYER_RADIUS),
      y: clamp(y + ny * speed * dt, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
    };
  }

  // ─── Reconciliation ──────────────────────────────────────────────────

  /**
   * Called when a positionAck arrives from the server.
   *
   * Algorithm:
   *   1. Start at the server's authoritative position (serverX, serverY).
   *   2. Remove all history entries with seq <= lastSeq (server already
   *      processed those — no need to replay).
   *   3. Re-simulate every remaining input (seq > lastSeq) to arrive at
   *      a corrected predicted position.
   *
   * Returns the corrected (predicted) position that the client should
   * smoothly lerp toward to avoid snapping.
   */
  reconcile(
    serverX: number,
    serverY: number,
    lastSeq: number,
    speed:   number,
  ): { x: number; y: number } {
    // Drop acknowledged inputs from history
    this.history = this.history.filter((r) => r.seq > lastSeq);

    // Re-simulate from server position
    let x = serverX;
    let y = serverY;

    for (const r of this.history) {
      const pos = this.applyStep(x, y, r.dx, r.dy, r.dt, speed);
      x = pos.x;
      y = pos.y;
    }

    return { x, y };
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
