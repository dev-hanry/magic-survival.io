import Phaser from "phaser";
import { BASE_XP, XP_LEVEL_MULTIPLIER } from "@shared/constants";

/**
 * HUD
 * ───
 * Fixed-position UI layer drawn in screen-space (camera-scroll-ignored).
 * All objects live in UIScene, not GameScene, so they don't scroll.
 *
 * Exposes:
 *   hud.update(xp, level, playerCount)  — call from UIScene.update()
 */
export class HUD {
  private scene:       Phaser.Scene;

  // XP bar
  private xpBarBg:    Phaser.GameObjects.Rectangle;
  private xpBarFill:  Phaser.GameObjects.Rectangle;
  private xpText:     Phaser.GameObjects.Text;

  // Level
  private levelText:  Phaser.GameObjects.Text;

  // Players online
  private onlineText: Phaser.GameObjects.Text;

  // Compass / mini status
  private statusText: Phaser.GameObjects.Text;

  private readonly BAR_W  = 300;
  private readonly BAR_H  = 16;
  private readonly BAR_X  = 20;
  private readonly BAR_Y  = 20;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const W = scene.cameras.main.width;

    // ── XP bar background ─────────────────────────────────────────────
    this.xpBarBg = scene.add.rectangle(
      this.BAR_X,
      this.BAR_Y,
      this.BAR_W,
      this.BAR_H,
      0x222233
    )
    .setOrigin(0, 0)
    .setDepth(200)
    .setScrollFactor(0)
    .setStrokeStyle(1, 0x445566);

    // ── XP bar fill ───────────────────────────────────────────────────
    this.xpBarFill = scene.add.rectangle(
      this.BAR_X + 1,
      this.BAR_Y + 1,
      0,
      this.BAR_H - 2,
      0x00ff88
    )
    .setOrigin(0, 0)
    .setDepth(201)
    .setScrollFactor(0);

    // ── XP text ───────────────────────────────────────────────────────
    this.xpText = scene.add.text(
      this.BAR_X + this.BAR_W / 2,
      this.BAR_Y + this.BAR_H / 2,
      "0 / 40 XP",
      {
        fontSize:   "10px",
        fontFamily: "'Courier New', monospace",
        color:      "#ffffff",
      }
    )
    .setOrigin(0.5, 0.5)
    .setDepth(202)
    .setScrollFactor(0);

    // ── Level ─────────────────────────────────────────────────────────
    this.levelText = scene.add.text(
      this.BAR_X,
      this.BAR_Y + this.BAR_H + 8,
      "LEVEL 1",
      {
        fontSize:        "15px",
        fontFamily:      "'Courier New', monospace",
        color:           "#ffdd44",
        stroke:          "#000",
        strokeThickness: 3,
      }
    )
    .setDepth(202)
    .setScrollFactor(0);

    // ── Online count ──────────────────────────────────────────────────
    this.onlineText = scene.add.text(
      W - 10,
      10,
      "1 online",
      {
        fontSize:   "12px",
        fontFamily: "'Courier New', monospace",
        color:      "#8899aa",
      }
    )
    .setOrigin(1, 0)
    .setDepth(202)
    .setScrollFactor(0);

    // ── Status hint ───────────────────────────────────────────────────
    this.statusText = scene.add.text(
      W / 2,
      scene.cameras.main.height - 24,
      "WASD / Arrow Keys to move",
      {
        fontSize:   "11px",
        fontFamily: "'Courier New', monospace",
        color:      "#445566",
      }
    )
    .setOrigin(0.5, 1)
    .setDepth(202)
    .setScrollFactor(0);

    // Fade hint after 5 s
    scene.time.delayedCall(5000, () => {
      scene.tweens.add({ targets: this.statusText, alpha: 0, duration: 1500 });
    });
  }

  // ─── Public update ───────────────────────────────────────────────────

  update(xp: number, level: number, playerCount: number): void {
    const required = Math.floor(BASE_XP * Math.pow(XP_LEVEL_MULTIPLIER, level - 1));
    const pct      = Math.min(xp / required, 1);
    const fillW    = Math.round((this.BAR_W - 2) * pct);

    this.scene.tweens.add({
      targets:  this.xpBarFill,
      width:    fillW,
      duration: 120,
      ease:     "Cubic.easeOut",
    });

    this.xpText.setText(`${Math.floor(xp)} / ${required} XP`);
    this.levelText.setText(`LEVEL ${level}`);
    this.onlineText.setText(`${playerCount} online`);
  }
}
