import "reflect-metadata";   // MUST be first — required by @colyseus/schema decorators

import { Server }      from "colyseus";
import { createServer } from "http";
import express          from "express";
import cors             from "cors";
import { ArenaRoom }   from "./rooms/ArenaRoom";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const httpServer = createServer(app);

const gameServer = new Server({ server: httpServer });
gameServer.define("arena", ArenaRoom);

// Simple health-check used by the client's ConnectionStatus widget
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

httpServer.listen(PORT, () => {
  console.log(`\n🎮  Arena Game Server`);
  console.log(`    WebSocket : ws://localhost:${PORT}`);
  console.log(`    Health    : http://localhost:${PORT}/health`);
  console.log(`    Room      : "arena"\n`);
});
