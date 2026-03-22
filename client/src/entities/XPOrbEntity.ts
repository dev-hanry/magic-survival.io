import Phaser from "phaser";

/**
 * XPOrbEntity — visual representation of a single XP orb.
 *
 * Features:
 *   • Gentle floating bob via tween
 *   • Particle burst + floating text on pickup
 *   • markCollected() triggers the FX and then destroys the object
 */
export class XPOrbEntity {
  readonly id:     string;
  readonly sprite: Phaser.GameObjects.Image;
  private  scene:  Phaser.Scene;
  private  bobTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number, value: number) {
    this.id    = id;
    this.scene = scene;

    this.sprite = scene.add.image(x, y, "xp_orb").setDepth(3);

    // Gentle idle bob
    this.bobTween = scene.tweens.add({
      targets:  this.sprite,
      y:        y - 6,
      duration: 800 + Math.random() * 400,
      yoyo:     true,
      repeat:   -1,
      ease:     "Sine.easeInOut",
    });
  }

  // ─── Pickup FX ───────────────────────────────────────────────────────

  markCollected(xpValue: number, emitter: Phaser.GameObjects.Particles.ParticleEmitter): void {
    if (!this.sprite.active) return;

    const x = this.sprite.x;
    const y = this.sprite.y;

    // Particle burst
    emitter.explode(8, x, y);

    // Floating "+XP" text
    const txt = this.scene.add
      .text(x, y, `+${xpValue}`, {
        fontSize:        "14px",
        fontFamily:      "'Courier New', monospace",
        color:           "#88ffaa",
        stroke:          "#000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(50);

    this.scene.tweens.add({
      targets:  txt,
      y:        y - 40,
      alpha:    0,
      duration: 900,
      ease:     "Cubic.easeOut",
      onComplete: () => txt.destroy(),
    });

    // Flash white then destroy
    this.scene.tweens.add({
      targets:  this.sprite,
      alpha:    0,
      scaleX:   2.5,
      scaleY:   2.5,
      duration: 200,
      ease:     "Cubic.easeOut",
      onComplete: () => this.destroy(),
    });
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  destroy(): void {
    this.bobTween?.stop();
    this.sprite.destroy();
  }
}
