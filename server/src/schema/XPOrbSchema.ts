import "reflect-metadata";
import { Schema, type } from "@colyseus/schema";

/**
 * XP orb schema — position and value synced to clients.
 * Collected flag lets server mark as "dead" before deletion
 * (prevents race conditions if two players reach the same orb).
 */
export class XPOrbSchema extends Schema {
  @type("string")  id:        string  = "";
  @type("float32") x:         number  = 0;
  @type("float32") y:         number  = 0;
  @type("uint8")   value:     number  = 5;
  @type("boolean") collected: boolean = false;
}
