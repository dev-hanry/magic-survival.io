import Phaser from "phaser";
import { ENEMY_TYPES } from "@shared/enemyTypes";

/**
 * BootScene — runs once before GameScene.
 *
 * All visuals are procedurally generated here so the game needs zero
 * external image files. Replace any generateTexture call with a real
 * spritesheet later when you have art assets.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Nothing to load from disk
  }

  create(): void {
    this.makePlayerTexture();
    this.makeOrbTexture();
    this.makeOrbitWeaponTexture();
    this.makeParticleTexture();
    this.makeEnemyTextures();   // ← new

    // Remove loading overlay now that Phaser is ready
    const overlay = document.getElementById("loading");
    if (overlay) {
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 500);
    }

    this.scene.start("GameScene");
  }

  // ─── Texture generators ──────────────────────────────────────────────

  private makePlayerTexture(): void {
    const size = 48;
    const g    = this.make.graphics();

    // Outer glow ring
    g.fillStyle(0x00ff88, 0.15);
    g.fillCircle(size / 2, size / 2, size / 2);

    // Body
    g.fillStyle(0x00ff88, 1);
    g.fillCircle(size / 2, size / 2, 16);

    // Highlight
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(size / 2 - 5, size / 2 - 5, 6);

    g.generateTexture("player_local", size, size);
    g.destroy();

    // Remote player (orange tint)
    const g2 = this.make.graphics();
    g2.fillStyle(0xff6644, 0.15);
    g2.fillCircle(size / 2, size / 2, size / 2);
    g2.fillStyle(0xff6644, 1);
    g2.fillCircle(size / 2, size / 2, 16);
    g2.fillStyle(0xffffff, 0.3);
    g2.fillCircle(size / 2 - 5, size / 2 - 5, 5);
    g2.generateTexture("player_remote", size, size);
    g2.destroy();
  }

  private makeOrbTexture(): void {
    const size = 24;
    const g    = this.make.graphics();

    // Outer glow
    g.fillStyle(0x44ff88, 0.25);
    g.fillCircle(size / 2, size / 2, size / 2);

    // Core
    g.fillStyle(0x88ffaa, 1);
    g.fillCircle(size / 2, size / 2, 6);

    // Bright centre
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(size / 2, size / 2, 3);

    g.generateTexture("xp_orb", size, size);
    g.destroy();
  }

  private makeOrbitWeaponTexture(): void {
    const size = 20;
    const g    = this.make.graphics();

    // Glow
    g.fillStyle(0xffcc00, 0.2);
    g.fillCircle(size / 2, size / 2, size / 2);

    // Core
    g.fillStyle(0xffcc00, 1);
    g.fillCircle(size / 2, size / 2, 7);

    // Highlight
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(size / 2 - 2, size / 2 - 2, 3);

    g.generateTexture("orbit_weapon", size, size);
    g.destroy();
  }

  private makeParticleTexture(): void {
    const size = 8;
    const g    = this.make.graphics();
    g.fillStyle(0x88ffaa, 1);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.generateTexture("particle", size, size);
    g.destroy();
  }

  private makeEnemyTextures(): void {
    // Generate one procedural texture per enemy type using their tint color
    for (const [_id, def] of Object.entries(ENEMY_TYPES)) {
      const size   = def.radius * 2 + 8;
      const cx     = size / 2;
      const r      = def.radius;
      const g      = this.make.graphics();

      // Outer glow
      g.fillStyle(def.tint, 0.2);
      g.fillCircle(cx, cx, r + 4);

      // Body
      g.fillStyle(def.tint, 0.9);
      g.fillCircle(cx, cx, r);

      // Dark inner ring for depth
      g.lineStyle(2, 0x000000, 0.4);
      g.strokeCircle(cx, cx, r - 2);

      // Highlight
      g.fillStyle(0xffffff, 0.25);
      g.fillCircle(cx - r * 0.3, cx - r * 0.3, r * 0.35);

      // "Eyes" placeholder — two dots
      g.fillStyle(0x000000, 0.7);
      g.fillCircle(cx - r * 0.25, cx - r * 0.1, r * 0.15);
      g.fillCircle(cx + r * 0.25, cx - r * 0.1, r * 0.15);

      g.generateTexture(def.sprite, size, size);
      g.destroy();
    }
  }
}
