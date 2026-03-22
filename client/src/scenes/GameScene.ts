import Phaser                  from "phaser";
import { NetworkManager }      from "../network/NetworkManager";
import { InputSystem }         from "../systems/InputSystem";
import { InterpolationSystem } from "../systems/InterpolationSystem";
import { PredictionSystem }    from "../systems/PredictionSystem";
import { LocalPlayer }         from "../entities/LocalPlayer";
import { RemotePlayer }        from "../entities/RemotePlayer";
import { XPOrbEntity }         from "../entities/XPOrbEntity";
import { EnemyEntity }         from "../entities/EnemyEntity";
import { LevelUpPanel }        from "../ui/LevelUpPanel";
import { SERVER_URL, WORLD_WIDTH, WORLD_HEIGHT } from "@shared/constants";
import { LevelUpPayload, UpgradeId, HitEvent, ServerPositionUpdate } from "@shared/types";

/**
 * GameScene — the heart of the client.
 *
 * Responsibilities:
 *   • Connect to server and maintain room reference
 *   • Spawn / update / destroy LocalPlayer, RemotePlayers, XPOrbs
 *   • Send player input to server each frame
 *   • Handle levelUp messages → show LevelUpPanel
 *   • Draw world background and camera follow
 *   • Forward HUD data to UIScene via event bus
 *
 * Everything that could be its own class IS its own class.
 * This scene only orchestrates, not implements.
 */
export class GameScene extends Phaser.Scene {
  // ── Network ─────────────────────────────────────────────────────────
  private network!:       NetworkManager;

  // ── Systems ──────────────────────────────────────────────────────────
  private inputSystem!:   InputSystem;
  private interpolation!: InterpolationSystem;
  private prediction!:    PredictionSystem;

  // ── Entities ─────────────────────────────────────────────────────────
  private localPlayer:    LocalPlayer | null  = null;
  private remotePlayers   = new Map<string, RemotePlayer>();
  private xpOrbs          = new Map<string, XPOrbEntity>();
  private enemies         = new Map<string, EnemyEntity>();

  // ── UI ───────────────────────────────────────────────────────────────
  private levelUpPanel!:  LevelUpPanel;

  // ── Particles ────────────────────────────────────────────────────────
  private pickupEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hitEmitter!:    Phaser.GameObjects.Particles.ParticleEmitter;

  // ── Local cached state for HUD + prediction ─────────────────────
  private myXP    = 0;
  private myLevel = 1;
  private mySpeed = 220;  // mirrors player.speed for local prediction

  // ── Pause flag (no input while upgrade panel open) ───────────────
  private isPaused = false;

  constructor() {
    super({ key: "GameScene" });
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────

  async create(): Promise<void> {
    this.buildWorld();

    this.inputSystem   = new InputSystem();
    this.interpolation = new InterpolationSystem();
    this.prediction    = new PredictionSystem();
    this.inputSystem.create(this);

    this.buildParticles();

    this.levelUpPanel = new LevelUpPanel(this, (id: UpgradeId) => {
      this.network.sendUpgrade(id);
      this.isPaused = false;
      this.inputSystem.enable();
    });


    // Start UI scene as overlay
    this.scene.launch("UIScene");

    // Connect to server
    this.network = new NetworkManager(SERVER_URL);
    try {
      const room = await this.network.connect();
      this.setupRoomListeners(room);
    } catch (err) {
      console.error("[GameScene] Failed to connect:", err);
      this.showConnectionError();
    }
  }

  update(_time: number, delta: number): void {
    if (!this.localPlayer) return;

    const dt = delta / 1000; // seconds

    // ── Read input every frame ────────────────────────────────────
    const { dx, dy, seq } = this.inputSystem.getInput();

    if (!this.isPaused) {
      // 1. Apply movement LOCALLY this frame — instant, zero-lag response
      this.localPlayer.applyPrediction(dx, dy, dt);

      // 2. Record input in history buffer for server reconciliation replay
      this.prediction.record(seq, dx, dy, delta);

      // 3. Send to server ONLY when movement state changes — this fixes stuck
      //    movement (missed keyup) and cuts unnecessary network traffic
      if (this.inputSystem.hasStateChanged()) {
        this.network.sendMove(this.inputSystem.getMovementState());
      }
    }

    // ── Update entities ──────────────────────────────────────────
    this.localPlayer.update(delta);
    this.remotePlayers.forEach((rp) => rp.update(delta));
    this.enemies.forEach((e) => e.update(delta));

    // ── Camera follow ──────────────────────────────────────────
    this.cameras.main.centerOn(this.localPlayer.x, this.localPlayer.y);

    // ── HUD update ───────────────────────────────────────────────
    this.game.events.emit("hud:update", {
      xp:          this.myXP,
      level:       this.myLevel,
      playerCount: this.remotePlayers.size + 1,
    });
  }

  // ─── World / visual setup ────────────────────────────────────────────

  private buildWorld(): void {
    // Tile a subtle grid across the entire world
    const gfx = this.add.graphics().setDepth(0);

    // World boundary
    gfx.lineStyle(2, 0x223344, 1);
    gfx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Grid lines every 200 px
    gfx.lineStyle(1, 0x0d1a28, 1);
    for (let x = 0; x <= WORLD_WIDTH; x += 200) {
      gfx.moveTo(x, 0); gfx.lineTo(x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += 200) {
      gfx.moveTo(0, y); gfx.lineTo(WORLD_WIDTH, y);
    }
    gfx.strokePath();

    // Scattered accent dots for depth
    gfx.fillStyle(0x112233, 1);
    for (let i = 0; i < 400; i++) {
      gfx.fillCircle(
        Math.random() * WORLD_WIDTH,
        Math.random() * WORLD_HEIGHT,
        1 + Math.random() * 2
      );
    }

    // Camera bounds
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setZoom(1);
  }

  private buildParticles(): void {
    this.pickupEmitter = this.add.particles(0, 0, "particle", {
      speed:     { min: 40, max: 120 },
      angle:     { min: 0, max: 360 },
      scale:     { start: 0.8, end: 0 },
      alpha:     { start: 1,   end: 0 },
      lifespan:  500,
      quantity:  0,
    });
    this.pickupEmitter.setDepth(50);

    // Red burst for enemy hit feedback
    this.hitEmitter = this.add.particles(0, 0, "particle", {
      speed:    { min: 30, max: 90 },
      angle:    { min: 0, max: 360 },
      tint:     0xff3333,
      scale:    { start: 0.7, end: 0 },
      alpha:    { start: 1,   end: 0 },
      lifespan: 280,
      quantity: 0,
    });
    this.hitEmitter.setDepth(50);
  }

  // ─── Room event wiring ───────────────────────────────────────────────

  private setupRoomListeners(room: import("colyseus.js").Room): void {
    const sid = room.sessionId;

    // ── Initial state + incremental patches ──────────────────────────

    room.state.players.onAdd((player: any, key: string) => {
      if (key === sid) {
        // This is our player
        this.localPlayer = new LocalPlayer(this, player.x, player.y);
        this.myXP    = player.xp;
        this.myLevel = player.level;
        this.cameras.main.centerOn(player.x, player.y);

        // Mirror server updates (stats only — position via positionAck)
        player.onChange(() => {
          if (!this.localPlayer) return;
          // Update speed cache for local prediction
          this.mySpeed = player.speed;
          this.localPlayer.setServerState({
            id:           key,
            x:            player.x,
            y:            player.y,
            xp:           player.xp,
            level:        player.level,
            orbitCount:   player.orbitCount,
            orbitRadius:  player.orbitRadius,
            orbitSpeed:   player.orbitSpeed,
            speed:        player.speed,
            pickupRadius: player.pickupRadius,
          });
          this.myXP    = player.xp;
          this.myLevel = player.level;
        });
      } else {
        // Remote player
        const rp = new RemotePlayer(this, this.interpolation, key, player.x, player.y);
        this.remotePlayers.set(key, rp);

        player.onChange(() => {
          const remote = this.remotePlayers.get(key);
          remote?.applyServerState({
            id:           key,
            x:            player.x,
            y:            player.y,
            xp:           player.xp,
            level:        player.level,
            orbitCount:   player.orbitCount,
            orbitRadius:  player.orbitRadius,
            orbitSpeed:   player.orbitSpeed,
            speed:        player.speed,
            pickupRadius: player.pickupRadius,
          });
        });
      }
    });

    room.state.players.onRemove((_player: any, key: string) => {
      const rp = this.remotePlayers.get(key);
      rp?.destroy();
      this.remotePlayers.delete(key);
    });

    // ── XP Orbs ──────────────────────────────────────────────────────

    room.state.xpOrbs.onAdd((orb: any, orbId: string) => {
      const entity = new XPOrbEntity(this, orbId, orb.x, orb.y, orb.value);
      this.xpOrbs.set(orbId, entity);

      orb.onChange(() => {
        if (orb.collected) {
          const e = this.xpOrbs.get(orbId);
          if (e) {
            e.markCollected(orb.value, this.pickupEmitter);
            this.xpOrbs.delete(orbId);
          }
        }
      });
    });

    room.state.xpOrbs.onRemove((_orb: any, orbId: string) => {
      // Orb may already be destroyed via markCollected
      const e = this.xpOrbs.get(orbId);
      if (e) {
        e.destroy();
        this.xpOrbs.delete(orbId);
      }
    });

    // ── Position reconciliation (server ack) ─────────────────────────

    room.onMessage<ServerPositionUpdate>("positionAck", (ack) => {
      if (!this.localPlayer) return;
      // Replay unacknowledged inputs on top of server position
      const corrected = this.prediction.reconcile(
        ack.x, ack.y, ack.lastSeq, this.mySpeed,
      );
      // Smoothly blend predicted position toward corrected value
      this.localPlayer.reconcile(corrected.x, corrected.y);
    });

    // ── Level-up ─────────────────────────────────────────────────────

    room.onMessage("levelUp", (payload: LevelUpPayload) => {
      this.isPaused = true;
      this.inputSystem.disable();
      this.levelUpPanel.show(payload.level, payload.upgrades);
      this.flashLevelUp();
    });

    // ── Enemies ───────────────────────────────────────────────────────

    room.state.enemies.onAdd((enemy: any, enemyId: string) => {
      const e = new EnemyEntity(
        this,
        this.interpolation,
        enemyId,
        enemy.type,
        enemy.x,
        enemy.y,
        enemy.hp,
        enemy.maxHp,
      );
      this.enemies.set(enemyId, e);

      enemy.onChange(() => {
        const ent = this.enemies.get(enemyId);
        if (!ent) return;
        ent.applyServerState(enemy.x, enemy.y, enemy.hp, enemy.maxHp, enemy.dead);
      });
    });

    room.state.enemies.onRemove((_enemy: any, enemyId: string) => {
      const ent = this.enemies.get(enemyId);
      if (ent) {
        ent.destroy();
        this.enemies.delete(enemyId);
      }
    });

    // ── Enemy hit feedback (damage numbers + particles) ──────────────

    room.onMessage("enemyHits", (hits: HitEvent[]) => {
      hits.forEach((hit) => {
        // Flash the enemy sprite
        const ent = this.enemies.get(hit.enemyId);
        ent?.flashHit();

        // Red particle burst at impact point
        this.hitEmitter.explode(6, hit.x, hit.y);

        // Floating damage number
        const dmgTxt = this.add
          .text(
            hit.x + Phaser.Math.Between(-10, 10),
            hit.y - 10,
            `-${hit.damage}`,
            {
              fontSize:        "13px",
              fontFamily:      "'Courier New', monospace",
              color:           "#ff4444",
              stroke:          "#000",
              strokeThickness: 3,
            }
          )
          .setOrigin(0.5)
          .setDepth(60);

        this.tweens.add({
          targets:    dmgTxt,
          y:          hit.y - 50,
          alpha:      0,
          duration:   750,
          ease:       "Cubic.easeOut",
          onComplete: () => dmgTxt.destroy(),
        });
      });
    });
  }

  // ─── Visual feedback ─────────────────────────────────────────────────

  private flashLevelUp(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    const flash = this.add.rectangle(
      this.cameras.main.scrollX + W / 2,
      this.cameras.main.scrollY + H / 2,
      W, H,
      0xffdd44, 0.18
    ).setDepth(90).setScrollFactor(0);

    this.tweens.add({
      targets:  flash,
      alpha:    0,
      duration: 600,
      ease:     "Cubic.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  private showConnectionError(): void {
    this.add.text(
      this.cameras.main.width  / 2,
      this.cameras.main.height / 2,
      "⚠  Could not connect to server\nMake sure `npm run dev` is running in /server",
      {
        fontSize:   "16px",
        fontFamily: "'Courier New', monospace",
        color:      "#ff4444",
        align:      "center",
      }
    )
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(999);
  }
}
