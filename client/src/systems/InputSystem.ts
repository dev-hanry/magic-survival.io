import Phaser from "phaser";
import { MovementState } from "@shared/types";

/**
 * InputSystem
 * ───────────
 * Collects player intent from keyboard (WASD / Arrow keys) and
 * a virtual joystick (touch / mouse drag).
 *
 * Key design: movement state is tracked as explicit booleans
 * {up, down, left, right} driven by keydown/keyup events —
 * NOT by polling isDown each frame. This guarantees that key
 * releases always trigger a state-change message to the server,
 * eliminating the "stuck movement" bug.
 *
 * The scene still receives a normalised direction vector for
 * local prediction, and a boolean `hasStateChanged()` flag to
 * decide when to send the movement state to the server.
 */
export class InputSystem {
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    UP:    Phaser.Input.Keyboard.Key;
    DOWN:  Phaser.Input.Keyboard.Key;
    LEFT:  Phaser.Input.Keyboard.Key;
    RIGHT: Phaser.Input.Keyboard.Key;
  };

  // ── Explicit boolean movement state (event-driven) ─────────────────
  private moveState = { up: false, down: false, left: false, right: false };

  // Flag: true when any key event changed moveState since last read
  private _stateChanged = false;

  // Virtual joystick state (populated by pointer handlers)
  private joyX = 0;
  private joyY = 0;
  private joystickActive = false;
  private joystickOrigin = { x: 0, y: 0 };

  private frameSeq = 0;

  // Previous direction — used for joystick change detection
  private prevDx = 0;
  private prevDy = 0;

  /** Call once inside Scene.create() */
  create(scene: Phaser.Scene): void {
    const kb = scene.input.keyboard!;

    this.keys = {
      W:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      UP:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      DOWN:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      LEFT:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };

    // ── Event-driven key tracking ────────────────────────────────────
    // These fire the instant the browser dispatches the event — no
    // polling delay, so key-up is never missed.

    const setDir = (dir: keyof typeof this.moveState, value: boolean) => {
      if (this.moveState[dir] !== value) {
        this.moveState[dir] = value;
        this._stateChanged = true;
      }
    };

    this.keys.W.on("down",  () => setDir("up",    true));
    this.keys.W.on("up",    () => setDir("up",    false));
    this.keys.UP.on("down", () => setDir("up",    true));
    this.keys.UP.on("up",   () => setDir("up",    false));

    this.keys.S.on("down",    () => setDir("down",  true));
    this.keys.S.on("up",      () => setDir("down",  false));
    this.keys.DOWN.on("down", () => setDir("down",  true));
    this.keys.DOWN.on("up",   () => setDir("down",  false));

    this.keys.A.on("down",     () => setDir("left",  true));
    this.keys.A.on("up",       () => setDir("left",  false));
    this.keys.LEFT.on("down",  () => setDir("left",  true));
    this.keys.LEFT.on("up",    () => setDir("left",  false));

    this.keys.D.on("down",      () => setDir("right", true));
    this.keys.D.on("up",        () => setDir("right", false));
    this.keys.RIGHT.on("down",  () => setDir("right", true));
    this.keys.RIGHT.on("up",    () => setDir("right", false));

    this.registerTouchHandlers(scene);
  }

  // ─── Per-frame read ──────────────────────────────────────────────────

  /**
   * Returns a normalised direction vector + monotonic sequence number.
   * Both dx and dy are in [-1, 1].
   */
  getInput(): { dx: number; dy: number; seq: number } {
    let dx = 0;
    let dy = 0;

    // Derive direction from boolean state
    if (this.moveState.left)  dx -= 1;
    if (this.moveState.right) dx += 1;
    if (this.moveState.up)    dy -= 1;
    if (this.moveState.down)  dy += 1;

    // Virtual joystick overrides keyboard when active
    if (this.joystickActive) {
      dx = this.joyX;
      dy = this.joyY;

      // For joystick, detect change via float comparison
      const rdx = Math.round(dx * 100) / 100;
      const rdy = Math.round(dy * 100) / 100;
      if (rdx !== this.prevDx || rdy !== this.prevDy) {
        this._stateChanged = true;
      }
      this.prevDx = rdx;
      this.prevDy = rdy;
    }

    // Normalise
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    if (dx !== 0 || dy !== 0) { dx /= len; dy /= len; }

    return { dx, dy, seq: this.frameSeq++ };
  }

  /**
   * Returns the current movement state for sending to the server.
   * The seq is the CURRENT frame sequence (same as the most recent getInput).
   */
  getMovementState(): MovementState {
    return {
      up:    this.moveState.up,
      down:  this.moveState.down,
      left:  this.moveState.left,
      right: this.moveState.right,
      seq:   this.frameSeq - 1,  // seq was already incremented by getInput()
    };
  }

  /**
   * True when the movement state changed since the last call.
   * Resets the flag on read so each change is sent exactly once.
   */
  hasStateChanged(): boolean {
    const changed = this._stateChanged;
    this._stateChanged = false;
    return changed;
  }

  // ─── Touch / virtual joystick ────────────────────────────────────────

  private registerTouchHandlers(scene: Phaser.Scene): void {
    const DEAD_ZONE = 10;
    const MAX_DIST  = 80;

    scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.joystickActive    = true;
      this.joystickOrigin.x  = p.x;
      this.joystickOrigin.y  = p.y;
      this.joyX = 0;
      this.joyY = 0;
    });

    scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.joystickActive || !p.isDown) return;

      const rawX = p.x - this.joystickOrigin.x;
      const rawY = p.y - this.joystickOrigin.y;
      const dist = Math.sqrt(rawX * rawX + rawY * rawY);

      if (dist < DEAD_ZONE) {
        this.joyX = 0;
        this.joyY = 0;
        return;
      }

      const clamped = Math.min(dist, MAX_DIST);
      this.joyX = (rawX / dist) * (clamped / MAX_DIST);
      this.joyY = (rawY / dist) * (clamped / MAX_DIST);
    });

    scene.input.on("pointerup", () => {
      this.joystickActive = false;
      this.joyX = 0;
      this.joyY = 0;
      this._stateChanged = true;  // joystick release = state change
    });
  }

  /** Disable all input (used while upgrade panel is open) */
  disable(): void {
    Object.values(this.keys).forEach((k) => k.reset());
    this.moveState = { up: false, down: false, left: false, right: false };
    this.joystickActive = false;
    this.joyX = 0;
    this.joyY = 0;
    this._stateChanged = true;  // Force send so server stops movement
  }

  /**
   * Re-enable input and instantly sync movement state with currently held keys.
   * Prevents players from having to release and re-press keys after UI closes.
   */
  enable(): void {
    this.moveState = {
      up:    this.keys.W.isDown || this.keys.UP.isDown,
      down:  this.keys.S.isDown || this.keys.DOWN.isDown,
      left:  this.keys.A.isDown || this.keys.LEFT.isDown,
      right: this.keys.D.isDown || this.keys.RIGHT.isDown,
    };
    this._stateChanged = true;
  }
}
