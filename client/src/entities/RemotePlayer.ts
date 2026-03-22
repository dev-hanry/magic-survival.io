import Phaser              from "phaser";
import { OrbitWeapon }    from "./OrbitWeapon";
import { InterpolationSystem } from "../systems/InterpolationSystem";
import { IPlayer }        from "@shared/types";
import { ORBIT_RADIUS, ORBIT_SPEED } from "@shared/constants";

/**
 * RemotePlayer
 * ─────────────
 * Represents another player in the arena.
 *
 * Position uses a two-layer smoothing approach:
 *   1. InterpolationSystem provides a target from its snapshot buffer
 *      (handles 20Hz server ticks → 60Hz render with render-delay)
 *   2. Render position lerps toward that target every frame, absorbing
 *      any remaining jitter for buttery-smooth motion.
 *
 * The orbit weapon count / config mirrors the server schema and updates
 * whenever the server broadcasts an upgrade for this player.
 */

/** Per-frame smoothing factor for render position */
const SMOOTH_LERP = 0.15;

/** Snap immediately if the error exceeds this (px) */
const SNAP_THRESHOLD = 100;

export class RemotePlayer {
  readonly id:      string;
  readonly sprite:  Phaser.GameObjects.Image;
  private  orbit:   OrbitWeapon;
  private  label:   Phaser.GameObjects.Text;
  private  interp:  InterpolationSystem;

  // Smoothed render position — lerps toward interpolation target each frame
  private _renderX: number;
  private _renderY: number;

  // Track last known orbit config to avoid rebuilding on every tick
  private _orbitCount  = 1;
  private _orbitRadius = ORBIT_RADIUS;
  private _orbitSpeed  = ORBIT_SPEED;

  constructor(
    scene:  Phaser.Scene,
    interp: InterpolationSystem,
    id:     string,
    x:      number,
    y:      number
  ) {
    this.id       = id;
    this.interp   = interp;
    this._renderX = x;
    this._renderY = y;

    this.sprite = scene.add.image(x, y, "player_remote").setDepth(8);

    this.orbit = new OrbitWeapon(scene, {
      count:         1,
      radius:        ORBIT_RADIUS,
      rotationSpeed: ORBIT_SPEED,
      damage:        0, // clients don't calculate damage
    });
    this.orbit.setDepth(7);

    // Short display label using last 4 chars of session ID
    const shortId = id.slice(-4).toUpperCase();
    this.label = scene.add
      .text(x, y - 22, shortId, {
        fontSize:        "10px",
        fontFamily:      "'Courier New', monospace",
        color:           "#ff8866",
        stroke:          "#000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(20);

    // Seed interpolation buffer with initial position
    this.interp.addSnapshot(id, x, y);
  }

  // ─── Per-frame update ────────────────────────────────────────────────

  update(delta: number): void {
    const target = this.interp.getPosition(this.id);
    if (!target) return;

    // Check if we need to snap (large discrepancy)
    const dx   = target.x - this._renderX;
    const dy   = target.y - this._renderY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > SNAP_THRESHOLD) {
      this._renderX = target.x;
      this._renderY = target.y;
    } else {
      // Smooth lerp toward interpolation target
      this._renderX += dx * SMOOTH_LERP;
      this._renderY += dy * SMOOTH_LERP;
    }

    this.sprite.setPosition(this._renderX, this._renderY);
    this.label.setPosition(this._renderX, this._renderY - 22);
    this.orbit.update(this._renderX, this._renderY, delta);
  }

  // ─── State sync (called on Colyseus onChange) ─────────────────────

  applyServerState(state: IPlayer): void {
    this.interp.addSnapshot(this.id, state.x, state.y);

    if (
      state.orbitCount  !== this._orbitCount  ||
      state.orbitRadius !== this._orbitRadius ||
      state.orbitSpeed  !== this._orbitSpeed
    ) {
      this._orbitCount  = state.orbitCount;
      this._orbitRadius = state.orbitRadius;
      this._orbitSpeed  = state.orbitSpeed;

      this.orbit.setConfig({
        count:         state.orbitCount,
        radius:        state.orbitRadius,
        rotationSpeed: state.orbitSpeed,
        damage:        0,
      });
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  destroy(): void {
    this.interp.remove(this.id);
    this.sprite.destroy();
    this.orbit.destroy();
    this.label.destroy();
  }
}
