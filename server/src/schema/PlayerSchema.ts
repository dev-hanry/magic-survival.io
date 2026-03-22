import "reflect-metadata";
import { Schema, type } from "@colyseus/schema";

/**
 * Server-authoritative player state.
 * All @type fields are auto-synced to every client via delta compression.
 * Non-decorated fields (inputDx/Dy) are server-only processing state.
 */
export class PlayerSchema extends Schema {
  @type("string")  id:           string = "";

  // Position (float32 keeps bandwidth low while giving sub-pixel precision)
  @type("float32") x:            number = 0;
  @type("float32") y:            number = 0;

  // Progression
  @type("float32") xp:           number = 0;
  @type("uint8")   level:        number = 1;

  // Orbit weapon state (synced so client can render correctly)
  @type("uint8")   orbitCount:   number = 1;
  @type("float32") orbitRadius:  number = 65;
  @type("float32") orbitSpeed:   number = 2.2;

  // Movement
  @type("float32") speed:        number = 220;

  // Magnet radius
  @type("float32") pickupRadius: number = 65;

  // ─── Server-only (never synced) ───────────────
  inputDx:          number = 0;
  inputDy:          number = 0;
  inputUp:          boolean = false;
  inputDown:        boolean = false;
  inputLeft:        boolean = false;
  inputRight:       boolean = false;
  lastProcessedSeq: number = -1;  // sequence of the last input the server applied
}
