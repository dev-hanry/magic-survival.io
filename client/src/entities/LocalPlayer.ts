import Phaser       from "phaser";
import { OrbitWeapon } from "./OrbitWeapon";
import { IPlayer }     from "@shared/types";
import { ORBIT_RADIUS, ORBIT_SPEED, WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS } from "@shared/constants";

/**
 * LocalPlayer
 * ────────────
 * Represents the player owned by this client.
 *
 * Movement model — client-side prediction + smooth server reconciliation:
 *   • `applyPrediction()` is called every frame BEFORE the server responds,
 *     moving the player immediately so input feels instant (zero perceived lag).
 *   • When a positionAck arrives, `reconcile()` stores the corrected target.
 *   • `update()` continuously lerps the render position toward the target
 *     every frame, producing smooth, jitter-free corrections like slither.io.
 *   • Orbit weapons and game stats (XP, level, speed) come from the server
 *     via `setServerState()`.
 */

/** Per-frame smoothing factor (~60 fps).
 *  0.15 converges in ~10 frames (≈167ms) — smooth but responsive. */
const SMOOTH_LERP = 0.15;

/** Max distance (px) before we hard-snap instead of lerping — prevents
 *  the player drifting across the map if they desynced badly. */
const SNAP_THRESHOLD = 100;

export class LocalPlayer {
  // ── Public read-only accessors ─────────────────────────────────────
  readonly sprite: Phaser.GameObjects.Image;
  private orbit:   OrbitWeapon;
  private scene:   Phaser.Scene;

  // Render position — what the player sees. Smoothly tracks the target.
  private _x = 0;
  private _y = 0;

  // Target position — updated by prediction + reconciliation.
  // The render position lerps toward this every frame.
  private _targetX = 0;
  private _targetY = 0;

  // Last known player speed from server (needed for local prediction math)
  private _speed = 220;

  // Orbit config mirrors (updated when server pushes upgrade)
  private _orbitCount  = 1;
  private _orbitRadius = ORBIT_RADIUS;
  private _orbitSpeed  = ORBIT_SPEED;

  // Label shown above player
  private nameLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene    = scene;
    this._x       = x;
    this._y       = y;
    this._targetX = x;
    this._targetY = y;

    this.sprite = scene.add.image(x, y, "player_local").setDepth(10);

    this.orbit = new OrbitWeapon(scene, {
      count:         1,
      radius:        ORBIT_RADIUS,
      rotationSpeed: ORBIT_SPEED,
      damage:        10,
    });

    this.nameLabel = scene.add
      .text(x, y - 28, "YOU", {
        fontSize:   "11px",
        fontFamily: "'Courier New', monospace",
        color:      "#00ff88",
        stroke:     "#000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
  }

  // ─── Prediction (called every frame before server response) ──────────

  /**
   * Immediately advance the target position by one frame of input.
   * Uses the SAME math as the server's MovementSystem so prediction
   * errors come only from network latency, not computation mismatch.
   *
   * @param dx  Normalised x direction [-1, 1]
   * @param dy  Normalised y direction [-1, 1]
   * @param dt  Frame delta time in seconds
   */
  applyPrediction(dx: number, dy: number, dt: number): void {
    if (dx === 0 && dy === 0) return;

    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx  = dx / len;
    const ny  = dy / len;

    this._targetX = clamp(this._targetX + nx * this._speed * dt, PLAYER_RADIUS, WORLD_WIDTH  - PLAYER_RADIUS);
    this._targetY = clamp(this._targetY + ny * this._speed * dt, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);
  }

  // ─── Reconciliation (called when positionAck arrives) ────────────────

  /**
   * Store the server-corrected target position. The actual position
   * correction happens continuously in update() via smooth lerp,
   * preventing the backward-snap jitter of single-shot correction.
   *
   * @param correctedX  Corrected x after replaying unacknowledged inputs
   * @param correctedY  Corrected y after replaying unacknowledged inputs
   */
  reconcile(correctedX: number, correctedY: number): void {
    const dx   = correctedX - this._targetX;
    const dy   = correctedY - this._targetY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > SNAP_THRESHOLD) {
      // Hard snap for massive discrepancies (server teleport, spawn, etc.)
      this._targetX = correctedX;
      this._targetY = correctedY;
      this._x       = correctedX;
      this._y       = correctedY;
    } else {
      // Just update the target — smooth lerp in update() handles the rest
      this._targetX = correctedX;
      this._targetY = correctedY;
    }
  }

  // ─── Frame update ────────────────────────────────────────────────────

  update(delta: number): void {
    // Smoothly blend render position toward target every frame
    // This is the key to eliminating backward snapping — the correction
    // is spread across many frames instead of applied in a single jerk.
    this._x += (this._targetX - this._x) * SMOOTH_LERP;
    this._y += (this._targetY - this._y) * SMOOTH_LERP;

    // Render at the smoothed position
    this.sprite.x = this._x;
    this.sprite.y = this._y;

    this.orbit.update(this.sprite.x, this.sprite.y, delta);
    this.nameLabel.setPosition(this.sprite.x, this.sprite.y - 22);
  }

  // ─── Server state sync ───────────────────────────────────────────────

  /**
   * Called when the server's state delta arrives (via Colyseus schema onChange).
   * We update game stats and orbit config here but do NOT update position —
   * position is handled exclusively through positionAck + reconcile().
   */
  setServerState(state: IPlayer): void {
    // Update movement speed (used by applyPrediction)
    this._speed = state.speed;

    // Rebuild orbit if config changed
    if (
      state.orbitCount  !== this._orbitCount  ||
      state.orbitRadius !== this._orbitRadius  ||
      state.orbitSpeed  !== this._orbitSpeed
    ) {
      this._orbitCount  = state.orbitCount;
      this._orbitRadius = state.orbitRadius;
      this._orbitSpeed  = state.orbitSpeed;

      this.orbit.setConfig({
        count:         state.orbitCount,
        radius:        state.orbitRadius,
        rotationSpeed: state.orbitSpeed,
        damage:        10,
      });
    }
  }

  // ─── Accessors ───────────────────────────────────────────────────────

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  destroy(): void {
    this.sprite.destroy();
    this.orbit.destroy();
    this.nameLabel.destroy();
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
