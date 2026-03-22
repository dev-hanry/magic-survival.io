import Phaser                from "phaser";
import { OrbitWeaponConfig } from "@shared/types";

/**
 * OrbitWeapon — client-side visual component.
 *
 * Manages a set of image objects that orbit a given world position.
 * The server owns truth about count / radius / speed; this class
 * purely renders the current authoritative values.
 *
 * Designed as a reusable, config-driven component:
 *   const orbit = new OrbitWeapon(scene, config);
 *   orbit.update(playerX, playerY, delta);     // call each frame
 *   orbit.setConfig(newConfig);                // called on upgrade
 *   orbit.destroy();
 */
export class OrbitWeapon {
  private scene:   Phaser.Scene;
  private config:  OrbitWeaponConfig;
  private objects: Phaser.GameObjects.Image[] = [];
  private angle    = 0; // current rotation angle (radians)

  constructor(scene: Phaser.Scene, config: OrbitWeaponConfig) {
    this.scene  = scene;
    this.config = { ...config };
    this.rebuild();
  }

  // ─── Per-frame update ────────────────────────────────────────────────

  update(px: number, py: number, deltaMs: number): void {
    this.angle += this.config.rotationSpeed * (deltaMs / 1000);

    const step = (Math.PI * 2) / this.objects.length;

    this.objects.forEach((obj, i) => {
      const a = this.angle + step * i;
      obj.setPosition(
        px + Math.cos(a) * this.config.radius,
        py + Math.sin(a) * this.config.radius
      );
      // Pulse scale for visual flair
      const pulse = 1 + Math.sin(this.angle * 3 + i) * 0.12;
      obj.setScale(pulse);
    });
  }

  // ─── Config update (called on upgrade) ──────────────────────────────

  setConfig(newConfig: Partial<OrbitWeaponConfig>): void {
    const prevCount = this.config.count;
    this.config     = { ...this.config, ...newConfig };

    if (newConfig.count !== undefined && newConfig.count !== prevCount) {
      this.rebuild();
    }
  }

  // ─── Internals ───────────────────────────────────────────────────────

  private rebuild(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];

    for (let i = 0; i < this.config.count; i++) {
      const obj = this.scene.add.image(0, 0, "orbit_weapon");
      obj.setDepth(5);
      this.objects.push(obj);
    }
  }

  setDepth(d: number): void {
    this.objects.forEach((o) => o.setDepth(d));
  }

  setVisible(v: boolean): void {
    this.objects.forEach((o) => o.setVisible(v));
  }

  destroy(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
  }

  /** Returns world-space positions of each orb (for hit detection placeholder) */
  getPositions(): { x: number; y: number }[] {
    return this.objects.map((o) => ({ x: o.x, y: o.y }));
  }
}
