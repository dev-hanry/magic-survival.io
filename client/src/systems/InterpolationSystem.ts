/**
 * InterpolationSystem
 * ────────────────────
 * Stores a small ring-buffer of (timestamp, x, y) snapshots per entity
 * and returns a position interpolated a fixed render-delay behind the
 * latest received snapshot.
 *
 * Why render-delay?
 *   We want to render at a point in the past where we always have at least
 *   two snapshots to interpolate between, even if a packet was briefly late.
 *   A delay of 2–3 server ticks (100–150 ms @ 20 Hz) is invisible to the
 *   player but eliminates visual jitter completely.
 *
 * Usage:
 *   interpolation.addSnapshot(id, x, y);         // called on state change
 *   const pos = interpolation.getPosition(id);   // called in update()
 */

const BUFFER_SIZE   = 10;    // snapshots kept per entity
const RENDER_DELAY  = 100;   // ms behind present to render

interface Snapshot {
  timestamp: number;
  x: number;
  y: number;
}

export class InterpolationSystem {
  private buffers = new Map<string, Snapshot[]>();

  // ─── Write ───────────────────────────────────────────────────────────

  addSnapshot(id: string, x: number, y: number): void {
    if (!this.buffers.has(id)) {
      this.buffers.set(id, []);
    }
    const buf = this.buffers.get(id)!;
    buf.push({ timestamp: Date.now(), x, y });

    // Keep buffer bounded
    if (buf.length > BUFFER_SIZE) buf.shift();
  }

  // ─── Read ────────────────────────────────────────────────────────────

  getPosition(id: string): { x: number; y: number } | null {
    const buf = this.buffers.get(id);
    if (!buf || buf.length === 0) return null;

    const renderTime = Date.now() - RENDER_DELAY;

    // Find the two snapshots that straddle renderTime
    let from: Snapshot | null = null;
    let to:   Snapshot | null = null;

    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].timestamp <= renderTime && buf[i + 1].timestamp >= renderTime) {
        from = buf[i];
        to   = buf[i + 1];
        break;
      }
    }

    // Not yet enough history — return latest known position
    if (!from || !to) {
      return { x: buf[buf.length - 1].x, y: buf[buf.length - 1].y };
    }

    // Linear interpolation
    const span = to.timestamp - from.timestamp;
    const t    = span === 0 ? 1 : (renderTime - from.timestamp) / span;

    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  remove(id: string): void {
    this.buffers.delete(id);
  }

  clear(): void {
    this.buffers.clear();
  }
}
