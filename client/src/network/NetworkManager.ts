import * as Colyseus from "colyseus.js";
import { PlayerInput, MovementState, UpgradeId } from "@shared/types";

/**
 * Thin wrapper around Colyseus.js.
 *
 * Responsibilities:
 *   • Establish WebSocket connection
 *   • Provide typed message senders
 *   • Expose room state for the scene to observe
 *
 * All game logic stays in the scenes/systems — this class only deals
 * with the network transport layer.
 */
export class NetworkManager {
  private client: Colyseus.Client;
  private _room:  Colyseus.Room | null = null;

  constructor(serverUrl: string) {
    this.client = new Colyseus.Client(serverUrl);
  }

  // ─── Connection ──────────────────────────────────────────────────────

  async connect(): Promise<Colyseus.Room> {
    this._room = await this.client.joinOrCreate("arena");
    console.log(`[Network] Connected — session: ${this._room.sessionId}`);
    return this._room;
  }

  // ─── Message senders ─────────────────────────────────────────────────

  sendInput(dx: number, dy: number, seq: number): void {
    const msg: PlayerInput = { dx, dy, seq };
    this._room?.send("input", msg);
  }

  /** Send explicit boolean movement state (keydown/keyup driven) */
  sendMove(state: MovementState): void {
    this._room?.send("move", state);
  }

  sendUpgrade(upgradeId: UpgradeId): void {
    this._room?.send("upgrade", upgradeId);
  }

  // ─── Accessors ───────────────────────────────────────────────────────

  get room():      Colyseus.Room | null { return this._room; }
  get sessionId(): string               { return this._room?.sessionId ?? ""; }
  get isConnected(): boolean            { return this._room !== null; }
}
