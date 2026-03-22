import "reflect-metadata";
import { Schema, type } from "@colyseus/schema";

/**
 * EnemySchema — server-authoritative enemy state.
 *
 * All @type fields are delta-synced to clients by Colyseus.
 * Server-only fields (velocity, hitCooldowns) are plain TS — never sent.
 *
 * `dead` is set true by server before removal so clients can play a
 * death animation before the entity disappears from the map.
 */
export class EnemySchema extends Schema {
  @type("string")  id:            string = "";
  @type("string")  type:          string = "slime";   // EnemyTypeId

  @type("float32") x:             number = 0;
  @type("float32") y:             number = 0;

  @type("float32") hp:            number = 40;
  @type("float32") maxHp:         number = 40;

  /** "idle" | "chasing" | "attacking" */
  @type("string")  state:         string = "idle";
  @type("string")  targetPlayerId:string = "";

  /** Set true the tick the enemy dies — triggers client death FX */
  @type("boolean") dead:          boolean = false;

  // ─── Server-only (never synced) ──────────────────────────────────
  vx: number = 0;
  vy: number = 0;
}
