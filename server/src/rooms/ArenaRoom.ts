import { Room, Client }        from "colyseus";
import { ArenaState }          from "../schema/ArenaState";
import { PlayerSchema }        from "../schema/PlayerSchema";
import { MovementSystem }      from "../systems/MovementSystem";
import { XPSystem }            from "../systems/XPSystem";
import { EnemySpawnSystem }    from "../systems/EnemySpawnSystem";
import { EnemyAISystem }       from "../systems/EnemyAISystem";
import { EnemyDamageSystem }   from "../systems/EnemyDamageSystem";
import {
  PLAYER_SPEED,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  ORBIT_RADIUS,
  ORBIT_SPEED,
  PICKUP_RADIUS,
  TICK_RATE,
} from "../../../shared/constants";
import { PlayerInput, MovementState, UpgradeId, LevelUpPayload, ServerPositionUpdate } from "../../../shared/types";

// All possible upgrade IDs — add new entries here to extend the pool
const UPGRADE_POOL: UpgradeId[] = [
  "orbitCount",
  "speed",
  "orbitSpeed",
  "orbitRadius",
  "pickupRadius",
];

/**
 * ArenaRoom
 * ──────────
 * • Server-authoritative: all state lives here
 * • Movement validated and applied in MovementSystem
 * • XP collection / levelling handled in XPSystem
 * • Clients send "input" each frame and "upgrade" on level-up choice
 * • Level-up pushes 3 random upgrade choices to the specific client
 */
export class ArenaRoom extends Room<ArenaState> {
  private movement      = new MovementSystem();
  private xpSystem      = new XPSystem();
  private enemySpawn    = new EnemySpawnSystem();
  private enemyAI       = new EnemyAISystem();
  private enemyDamage   = new EnemyDamageSystem();

  // ─── Lifecycle ───────────────────────────────────────────────────────

  onCreate(_options: unknown): void {
    this.setState(new ArenaState());

    // Simulation runs at TICK_RATE Hz
    this.setSimulationInterval(
      (deltaTime) => this.tick(deltaTime),
      1000 / TICK_RATE
    );

    this.xpSystem.spawnInitialOrbs(this.state);

    // ── Message handlers ──────────────────────────────────────────────

    /** Client sends normalised direction vector on each direction change */
    this.onMessage<PlayerInput>("input", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      // Clamp inputs — never trust the client fully
      p.inputDx          = clamp(msg.dx, -1, 1);
      p.inputDy          = clamp(msg.dy, -1, 1);
      p.lastProcessedSeq = msg.seq;   // track last input the server received
    });

    /**
     * Client sends explicit boolean movement state (keydown/keyup driven).
     * This is the PRIMARY handler — eliminates stuck-movement bugs because
     * key releases always flip the boolean to false.
     */
    this.onMessage<MovementState>("move", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.inputUp    = !!msg.up;
      p.inputDown  = !!msg.down;
      p.inputLeft  = !!msg.left;
      p.inputRight = !!msg.right;
      // Derive dx/dy so MovementSystem works without changes
      p.inputDx = (p.inputRight ? 1 : 0) - (p.inputLeft ? 1 : 0);
      p.inputDy = (p.inputDown  ? 1 : 0) - (p.inputUp   ? 1 : 0);
      p.lastProcessedSeq = msg.seq;
    });

    /** Client sends chosen upgrade ID after a level-up */
    this.onMessage<UpgradeId>("upgrade", (client, upgradeId) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      this.applyUpgrade(p, upgradeId);
    });
  }

  onJoin(client: Client): void {
    const p          = new PlayerSchema();
    p.id             = client.sessionId;
    p.x              = Math.random() * WORLD_WIDTH;
    p.y              = Math.random() * WORLD_HEIGHT;
    p.speed          = PLAYER_SPEED;
    p.orbitCount     = 1;
    p.orbitRadius    = ORBIT_RADIUS;
    p.orbitSpeed     = ORBIT_SPEED;
    p.pickupRadius   = PICKUP_RADIUS;
    p.level          = 1;
    p.xp             = 0;

    this.state.players.set(client.sessionId, p);
    console.log(`[ArenaRoom] ${client.sessionId} joined  (${this.clients.length} online)`);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.enemyDamage.removePlayer(client.sessionId);
    console.log(`[ArenaRoom] ${client.sessionId} left    (${this.clients.length} online)`);
  }

  // ─── Simulation tick ─────────────────────────────────────────────────

  private tick(deltaMs: number): void {
    const now = Date.now();

    this.movement.update(this.state, deltaMs);

    // ── Send per-player position acks for client-side reconciliation ──
    // Each client receives the authoritative position + the last input
    // sequence the server processed, so it can replay unacknowledged inputs.
    this.state.players.forEach((p, sessionId) => {
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (!client) return;
      const ack: ServerPositionUpdate = {
        x:       p.x,
        y:       p.y,
        lastSeq: p.lastProcessedSeq,
      };
      client.send("positionAck", ack);
    });

    this.xpSystem.update(this.state, (playerId, newLevel) => {
      const client = this.clients.find((c) => c.sessionId === playerId);
      if (!client) return;
      const upgrades = randomSample(UPGRADE_POOL, 3);
      const payload: LevelUpPayload = { level: newLevel, upgrades };
      client.send("levelUp", payload);
    });

    // ── Enemy systems (order matters) ────────────────────────────────
    this.enemySpawn.update(this.state, deltaMs);
    this.enemyAI.update(this.state, deltaMs);

    const hits = this.enemyDamage.update(this.state, deltaMs, now);

    // Broadcast hit events to all clients for floating damage numbers
    if (hits.length > 0) {
      this.broadcast("enemyHits", hits);
    }

    // Remove dead enemies one tick after they were marked dead
    // (client had one frame to see dead:true and play death FX)
    this.enemyDamage.deleteDeadEnemies(this.state, this.enemyAI);
  }

  // ─── Upgrade application ─────────────────────────────────────────────

  /**
   * Data-driven upgrade dispatcher.
   * Add new cases here as you expand the upgrade pool.
   */
  private applyUpgrade(p: PlayerSchema, id: UpgradeId): void {
    switch (id) {
      case "orbitCount":
        p.orbitCount   = Math.min(p.orbitCount + 1, 8);
        break;
      case "speed":
        p.speed        *= 1.10;
        break;
      case "orbitSpeed":
        p.orbitSpeed   *= 1.15;
        break;
      case "orbitRadius":
        p.orbitRadius  += 12;
        break;
      case "pickupRadius":
        p.pickupRadius += 15;
        break;
      default:
        console.warn(`[ArenaRoom] Unknown upgrade: ${id}`);
    }
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function randomSample<T>(arr: T[], n: number): T[] {
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, n);
}
