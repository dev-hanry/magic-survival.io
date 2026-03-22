import Phaser                  from "phaser";
import { InterpolationSystem } from "../systems/InterpolationSystem";
import { ENEMY_TYPES, EnemyTypeId } from "@shared/enemyTypes";

/**
 * EnemyEntity — client-side visual for a single enemy.
 *
 * Responsibilities:
 *   • Render placeholder sprite (tinted circle per type)
 *   • Smooth position via InterpolationSystem (same as RemotePlayer)
 *   • Draw HP bar above enemy
 *   • Flash red on hit (triggered externally via flashHit())
 *   • Play death burst when server sets dead:true (triggerDeath())
 *
 * All game logic stays on the server — this class is pure presentation.
 */
export class EnemyEntity {
  readonly id:      string;
  private scene:    Phaser.Scene;
  private interp:   InterpolationSystem;
  private typeId:   EnemyTypeId;           // stored directly

  private sprite:   Phaser.GameObjects.Image;
  private hpBg:     Phaser.GameObjects.Rectangle;
  private hpFill:   Phaser.GameObjects.Rectangle;

  private maxHp:    number;
  private isDead    = false;

  private readonly BAR_W = 36;
  private readonly BAR_H = 4;

  constructor(
    scene:   Phaser.Scene,
    interp:  InterpolationSystem,
    id:      string,
    type:    string,
    x:       number,
    y:       number,
    hp:      number,
    maxHp:   number,
  ) {
    this.id     = id;
    this.scene  = scene;
    this.interp = interp;
    this.maxHp  = maxHp;
    this.typeId = (type in ENEMY_TYPES ? type : "slime") as EnemyTypeId;

    const def    = ENEMY_TYPES[this.typeId];
    const texKey = def.sprite;

    this.sprite = scene.add.image(x, y, texKey).setDepth(6);

    // HP bar
    this.hpBg = scene.add.rectangle(x, y - def.radius - 8, this.BAR_W, this.BAR_H, 0x330000)
      .setOrigin(0.5, 0.5).setDepth(7);
    this.hpFill = scene.add.rectangle(x, y - def.radius - 8, this.BAR_W, this.BAR_H, 0xff3333)
      .setOrigin(0.5, 0.5).setDepth(8);

    this.updateHPBar(hp, maxHp, x, y);
    this.interp.addSnapshot(id, x, y);
  }

  // ─── Per-frame update ────────────────────────────────────────────────

  update(_delta: number): void {
    if (this.isDead) return;

    const pos = this.interp.getPosition(this.id);
    if (!pos) return;

    this.sprite.setPosition(pos.x, pos.y);

    const def  = ENEMY_TYPES[this.typeId];
    const barY = pos.y - def.radius - 8;
    this.hpBg.setPosition(pos.x, barY);
    this.hpFill.setOrigin(0, 0.5);
    this.hpFill.setPosition(pos.x - this.BAR_W / 2, barY);
  }

  // ─── State sync ──────────────────────────────────────────────────────

  applyServerState(x: number, y: number, hp: number, maxHp: number, dead: boolean): void {
    this.interp.addSnapshot(this.id, x, y);

    const pos = this.interp.getPosition(this.id);
    const cx  = pos?.x ?? x;
    const cy  = pos?.y ?? y;
    this.updateHPBar(hp, maxHp, cx, cy);

    if (dead && !this.isDead) {
      this.triggerDeath(cx, cy);
    }
  }

  // ─── Visual FX ───────────────────────────────────────────────────────

  /** Called by GameScene when it receives an enemyHits broadcast */
  flashHit(): void {
    if (this.isDead) return;
    this.scene.tweens.add({
      targets:  this.sprite,
      tint:     0xffffff,      // flash white
      duration: 60,
      yoyo:     true,
      onComplete: () => {
        if (this.sprite?.active) {
          // Restore original tint after flash
        }
      },
    });
    // Quick scale jolt
    this.scene.tweens.add({
      targets:  this.sprite,
      scaleX:   1.3,
      scaleY:   0.8,
      duration: 60,
      yoyo:     true,
      ease:     "Cubic.easeOut",
    });
  }

  triggerDeath(x: number, y: number): void {
    this.isDead = true;
    this.hpBg.destroy();
    this.hpFill.destroy();

    // Expand and fade
    this.scene.tweens.add({
      targets:  this.sprite,
      scaleX:   2.5,
      scaleY:   2.5,
      alpha:    0,
      duration: 350,
      ease:     "Cubic.easeOut",
      onComplete: () => this.sprite.destroy(),
    });
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────

  destroy(): void {
    this.interp.remove(this.id);
    if (this.sprite.active)  this.sprite.destroy();
    if (this.hpBg.active)    this.hpBg.destroy();
    if (this.hpFill.active)  this.hpFill.destroy();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private updateHPBar(hp: number, _maxHp: number, _cx: number, _cy: number): void {
    const pct = Math.max(0, Math.min(1, hp / this.maxHp));
    this.hpFill.width = Math.round(this.BAR_W * pct);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}
