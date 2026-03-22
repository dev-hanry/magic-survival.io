import Phaser       from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene }   from "./scenes/UIScene";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@shared/constants";

const config: Phaser.Types.Core.GameConfig = {
  type:            Phaser.AUTO,
  width:           Math.min(window.innerWidth,  1280),
  height:          Math.min(window.innerHeight, 720),
  backgroundColor: "#050510",
  parent:          document.body,

  physics: {
    default: "arcade",
    arcade:  { debug: false },
  },

  scene: [BootScene, GameScene, UIScene],
};

const game = new Phaser.Game(config);

// Responsive resize
window.addEventListener("resize", () => {
  game.scale.resize(
    Math.min(window.innerWidth,  1280),
    Math.min(window.innerHeight, 720)
  );
});

export default game;
