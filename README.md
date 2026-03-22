# 🎮 Arena — Multiplayer Survival Game Starter

A production-ready, fully-typed multiplayer arena game template built with:

- **Frontend**: Phaser 3 + TypeScript + Vite
- **Backend**: Node.js + Colyseus + TypeScript
- **Networking**: Server-authoritative movement, client interpolation, Colyseus delta sync

---

## Project Structure

```
arena-game/
├── client/
│   └── src/
│       ├── scenes/          # Phaser scene classes
│       │   ├── BootScene.ts      — procedural texture generation
│       │   ├── GameScene.ts      — main game loop + server wiring
│       │   └── UIScene.ts        — HUD overlay (scrollfactor:0)
│       ├── entities/        # Game object classes
│       │   ├── LocalPlayer.ts    — this client's player
│       │   ├── RemotePlayer.ts   — other players (interpolated)
│       │   ├── XPOrbEntity.ts    — XP orb with pickup FX
│       │   └── OrbitWeapon.ts    — reusable orbit component
│       ├── systems/         # Pure logic systems (no Phaser coupling)
│       │   ├── InputSystem.ts         — WASD + touch joystick
│       │   └── InterpolationSystem.ts — snapshot buffer + lerp
│       ├── ui/
│       │   ├── HUD.ts         — XP bar, level, online count
│       │   └── LevelUpPanel.ts — upgrade card panel
│       ├── network/
│       │   └── NetworkManager.ts — Colyseus.js wrapper
│       ├── data/
│       │   └── upgradeData.ts  — upgrade pool definitions (data-driven)
│       └── main.ts            — Phaser bootstrap
│
├── server/
│   └── src/
│       ├── rooms/
│       │   └── ArenaRoom.ts    — Colyseus room (join/leave/tick/messages)
│       ├── schema/
│       │   ├── ArenaState.ts   — root MapSchema state
│       │   ├── PlayerSchema.ts — synced player fields
│       │   └── XPOrbSchema.ts  — synced orb fields
│       ├── systems/
│       │   ├── MovementSystem.ts — server-auth movement
│       │   └── XPSystem.ts       — orb spawn/collection/levelling
│       └── index.ts            — HTTP + WebSocket server entry
│
└── shared/
    ├── constants.ts  — world size, speeds, XP formula params
    └── types.ts      — TypeScript interfaces shared by both sides
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### 1 — Install dependencies

```bash
# From project root
npm run install:all

# Or manually:
cd server && npm install
cd ../client && npm install
```

### 2 — Start the server

```bash
cd server
npm run dev
```

You should see:
```
🎮  Arena Game Server
    WebSocket : ws://localhost:2567
    Room      : "arena"
```

### 3 — Start the client (new terminal)

```bash
cd client
npm run dev
```

Vite will open `http://localhost:3000` automatically.

### 4 — Test multiplayer

Open **two browser tabs** (or two windows) both pointing to `http://localhost:3000`.  
Each tab creates a separate player — you'll see the other player moving in real time.

---

## Controls

| Input          | Action                   |
|----------------|--------------------------|
| WASD           | Move                     |
| Arrow Keys     | Move                     |
| Mouse drag / touch | Virtual joystick     |
| 1 / 2 / 3      | Select upgrade on level-up |
| Mouse click    | Select upgrade card      |

---

## Core Systems

### Server-Authoritative Movement
- Client sends `{ dx, dy, seq }` every frame
- Server validates, applies physics, broadcasts new position
- Client interpolates with 100 ms render delay to eliminate jitter

### XP System
- 120 orbs maintained in the world at all times
- Formula: `xpRequired = 40 × 1.5^(level-1)`
- Server detects pickup (player within `pickupRadius`), grants XP, notifies client
- Client plays particle burst + floating text on collection

### Level-Up Upgrade System
- Server picks 3 random upgrades from the pool, sends to specific client
- Client displays choice panel; input is disabled during selection
- Client sends chosen `upgradeId` back; server applies the effect

### Orbit Weapon
- Reusable `OrbitWeapon` component accepts config: `{ count, radius, rotationSpeed, damage }`
- Visually rotates N orbs around player each frame
- Server owns the canonical values; client mirrors them

---

## Extending the Game

### Add a new upgrade

**server/src/rooms/ArenaRoom.ts** — add to `UPGRADE_POOL` array and `applyUpgrade` switch  
**shared/types.ts** — add new `UpgradeId` to the union  
**client/src/data/upgradeData.ts** — add display metadata  

### Add enemy mobs

1. Create `server/src/schema/MobSchema.ts`  
2. Add `mobs: MapSchema<MobSchema>` to `ArenaState`  
3. Create `server/src/systems/MobAISystem.ts`  
4. Create `client/src/entities/MobEntity.ts`  

### Add a new room type (e.g. boss arena)

```typescript
// server/src/index.ts
gameServer.define("boss_arena", BossArenaRoom);
```

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Server-auth movement | Prevents speed hacks; 20 Hz is imperceptible lag |
| Render delay interpolation | Guarantees smooth motion even with packet jitter |
| Colyseus MapSchema | Auto delta-diff; only changed fields travel the wire |
| Shared `constants.ts` | Single source of truth for both sides |
| Data-driven upgrades | Add new upgrades without touching game logic |
| Procedural textures | Zero asset pipeline — replace with sprites when ready |

---

## Production Deployment Notes

- Set `SERVER_URL` in `client/src/main.ts` to your server's domain  
- Use `nginx` to reverse-proxy WebSocket (`ws://`) alongside HTTP  
- Colyseus supports horizontal scaling with `@colyseus/redis-presence`  
- Run server with `npm run build && npm start` (not ts-node-dev)  
