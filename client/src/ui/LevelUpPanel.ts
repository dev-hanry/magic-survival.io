import Phaser               from "phaser";
import { UpgradeId }        from "@shared/types";
import { UPGRADE_DATA }     from "../data/upgradeData";

type OnSelectCallback = (id: UpgradeId) => void;

/**
 * LevelUpPanel
 * ─────────────
 * A Phaser DOM-free upgrade selection UI built entirely from
 * Phaser GameObjects so it stays inside the canvas coordinate system.
 *
 * • Shown when the server sends a "levelUp" message
 * • Displays exactly 3 upgrade cards drawn from the server-provided list
 * • Keyboard: 1 / 2 / 3 to pick quickly; mouse click also works
 * • Calls onSelect(upgradeId) then hides itself
 */
export class LevelUpPanel {
  private scene:      Phaser.Scene;
  private container:  Phaser.GameObjects.Container;
  private onSelect:   OnSelectCallback;
  private keys!:      Phaser.Input.Keyboard.Key[];

  constructor(scene: Phaser.Scene, onSelect: OnSelectCallback) {
    this.scene    = scene;
    this.onSelect = onSelect;
    this.container = scene.add.container(0, 0).setDepth(100).setScrollFactor(0).setVisible(false);

    // 1 / 2 / 3 hotkeys
    const kb = scene.input.keyboard!;
    this.keys = [
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];
  }

  // ─── Show / hide ─────────────────────────────────────────────────────

  show(level: number, upgradeIds: UpgradeId[]): void {
    this.container.removeAll(true);

    const cx = this.scene.cameras.main.width  / 2;
    const cy = this.scene.cameras.main.height / 2;

    // ── Background overlay ────────────────────────────────────────────
    const overlay = this.scene.add.rectangle(
      0, 0,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000, 0.65
    ).setOrigin(0, 0);
    this.container.add(overlay);

    // ── Title ─────────────────────────────────────────────────────────
    const title = this.scene.add.text(cx, cy - 145, `LEVEL ${level}!`, {
      fontSize:        "32px",
      fontFamily:      "'Courier New', monospace",
      color:           "#ffdd44",
      stroke:          "#000",
      strokeThickness:  5,
    }).setOrigin(0.5).setDepth(101);
    this.container.add(title);

    const sub = this.scene.add.text(cx, cy - 108, "CHOOSE AN UPGRADE", {
      fontSize:   "14px",
      fontFamily: "'Courier New', monospace",
      color:      "#aaaaaa",
    }).setOrigin(0.5).setDepth(101);
    this.container.add(sub);

    // ── Cards ─────────────────────────────────────────────────────────
    const cardW   = 165;
    const cardH   = 140;
    const spacing = 18;
    const totalW  = cardW * 3 + spacing * 2;
    const startX  = cx - totalW / 2;

    upgradeIds.forEach((id, i) => {
      const def = UPGRADE_DATA[id];
      const cx2 = startX + i * (cardW + spacing) + cardW / 2;

      // Card background
      const bg = this.scene.add.rectangle(cx2, cy, cardW, cardH, 0x111122, 1)
        .setStrokeStyle(2, 0x3355aa)
        .setDepth(101)
        .setInteractive({ useHandCursor: true });

      this.container.add(bg);

      // Icon
      const icon = this.scene.add.text(cx2, cy - 40, def.icon, {
        fontSize: "30px",
      }).setOrigin(0.5).setDepth(102);
      this.container.add(icon);

      // Number hint
      const numHint = this.scene.add.text(cx2, cy - 62, `[${i + 1}]`, {
        fontSize:   "11px",
        fontFamily: "'Courier New', monospace",
        color:      "#888888",
      }).setOrigin(0.5).setDepth(102);
      this.container.add(numHint);

      // Name
      const name = this.scene.add.text(cx2, cy - 8, def.name, {
        fontSize:        "13px",
        fontFamily:      "'Courier New', monospace",
        color:           "#ffffff",
        stroke:          "#000",
        strokeThickness: 2,
        wordWrap:        { width: cardW - 14 },
        align:           "center",
      }).setOrigin(0.5).setDepth(102);
      this.container.add(name);

      // Description
      const desc = this.scene.add.text(cx2, cy + 38, def.description, {
        fontSize:   "10px",
        fontFamily: "'Courier New', monospace",
        color:      "#8899aa",
        wordWrap:   { width: cardW - 14 },
        align:      "center",
      }).setOrigin(0.5).setDepth(102);
      this.container.add(desc);

      // Hover highlight
      bg.on("pointerover",  () => bg.setFillStyle(0x1a2244, 1));
      bg.on("pointerout",   () => bg.setFillStyle(0x111122, 1));
      bg.on("pointerdown",  () => this.pick(id));

      // Entrance tween
      bg.setAlpha(0);
      icon.setAlpha(0);
      name.setAlpha(0);
      desc.setAlpha(0);
      numHint.setAlpha(0);

      const delay = 80 + i * 60;
      [bg, icon, name, desc, numHint].forEach((obj) => {
        this.scene.tweens.add({
          targets:  obj,
          alpha:    1,
          duration: 220,
          delay,
          ease:     "Cubic.easeOut",
        });
      });
    });

    // Wire keyboard hotkeys to this specific set of upgrades
    this.keys.forEach((key, i) => {
      key.once("down", () => {
        if (i < upgradeIds.length) this.pick(upgradeIds[i]);
      });
    });

    this.container.setVisible(true);

    // Animate title
    this.scene.tweens.add({
      targets:  title,
      scaleX:   [1.3, 1],
      scaleY:   [1.3, 1],
      duration: 300,
      ease:     "Back.easeOut",
    });
  }

  hide(): void {
    // Prevent ghost inputs — clean up all hotkey listeners when hiding
    this.keys.forEach((key) => key.removeAllListeners("down"));

    this.scene.tweens.add({
      targets:  this.container,
      alpha:    0,
      duration: 200,
      onComplete: () => {
        this.container.setVisible(false);
        this.container.setAlpha(1);
      },
    });
  }

  // ─── Internal ────────────────────────────────────────────────────────

  private pick(id: UpgradeId): void {
    if (!this.container.visible) return;
    this.onSelect(id);
    this.hide();
  }

  get isVisible(): boolean {
    return this.container.visible;
  }
}
