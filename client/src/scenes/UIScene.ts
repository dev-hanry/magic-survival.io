import Phaser from "phaser";
import { HUD }  from "../ui/HUD";

/**
 * UIScene
 * ────────
 * Runs in parallel with GameScene (launched as an overlay scene).
 * Hosts the HUD so it is never affected by camera scroll or zoom.
 *
 * Communication with GameScene uses the Phaser EventEmitter on game.events
 * (a cross-scene bus) to avoid tight coupling.
 */
export class UIScene extends Phaser.Scene {
  private hud!: HUD;

  constructor() {
    super({ key: "UIScene", active: false });
  }

  create(): void {
    this.hud = new HUD(this);

    // Listen for state updates broadcast by GameScene
    this.game.events.on("hud:update", (data: {
      xp:          number;
      level:       number;
      playerCount: number;
    }) => {
      this.hud.update(data.xp, data.level, data.playerCount);
    });
  }
}
