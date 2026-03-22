import "reflect-metadata";
import { Schema, type, MapSchema } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema";
import { XPOrbSchema }  from "./XPOrbSchema";
import { EnemySchema }  from "./EnemySchema";

/**
 * Root state for the Arena room.
 * Colyseus diffs this state every tick and sends only changed fields.
 */
export class ArenaState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: XPOrbSchema  }) xpOrbs  = new MapSchema<XPOrbSchema>();
  @type({ map: EnemySchema  }) enemies = new MapSchema<EnemySchema>();
}
