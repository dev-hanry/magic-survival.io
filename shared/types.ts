// ─────────────────────────────────────────────
//  Shared types — pure TS interfaces, no deps
// ─────────────────────────────────────────────

/** Sent from client → server on direction change */
export interface PlayerInput {
  dx:  number;  // -1 … 1
  dy:  number;
  seq: number;  // monotonic frame counter for reconciliation
}

/** Sent from client → server on keydown/keyup — explicit boolean state */
export interface MovementState {
  up:    boolean;
  down:  boolean;
  left:  boolean;
  right: boolean;
  seq:   number;  // monotonic frame counter for reconciliation
}

/**
 * Sent server → client (targeted, not broadcast) each tick.
 * Tells the owning client the authoritative position and which
 * input sequence number was the last one the server processed.
 * The client uses this to reconcile its predicted position.
 */
export interface ServerPositionUpdate {
  x:       number;
  y:       number;
  lastSeq: number;
}

/** Upgrade IDs known to both sides */
export type UpgradeId =
  | "orbitCount"
  | "speed"
  | "orbitSpeed"
  | "orbitRadius"
  | "pickupRadius";

/** Broadcast server → all clients when orbit weapons connect */
export interface HitEvent {
  enemyId: string;
  damage:  number;
  x:       number;
  y:       number;
}

/** Sent server → client on level-up */
export interface LevelUpPayload {
  level:    number;
  upgrades: UpgradeId[];  // exactly 3 random choices
}

/** Mirror of PlayerSchema for client-side typing */
export interface IPlayer {
  id:           string;
  x:            number;
  y:            number;
  xp:           number;
  level:        number;
  orbitCount:   number;
  speed:        number;
  orbitRadius:  number;
  orbitSpeed:   number;
  pickupRadius: number;
}

/** Mirror of XPOrbSchema for client-side typing */
export interface IXPOrb {
  id:    string;
  x:     number;
  y:     number;
  value: number;
}

/** Config passed into orbit weapon component */
export interface OrbitWeaponConfig {
  count:         number;
  radius:        number;
  rotationSpeed: number;
  damage:        number;
}
