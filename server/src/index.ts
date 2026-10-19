import "dotenv/config";
import fs from "node:fs";
import http from "node:http";
import express from "express";
import cors from "cors";
import type { StorageState } from "@timevault/shared";
import { serverConfig } from "./config";
import { InstallationCoordinator } from "./coordinator";
import { TimeVaultDatabase } from "./database";
import { attachSocketServer } from "./socket";

const app = express();
app.use(cors({ origin: serverConfig.clientOrigin }));
app.use(express.json());

let database: TimeVaultDatabase;
let storage: StorageState = { status: "PERSISTENT", error: null };
try {
  database = new TimeVaultDatabase(serverConfig.databasePath);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Persistent database unavailable; using in-memory recovery mode: ${message}`);
  database = new TimeVaultDatabase(":memory:");
  storage = { status: "MEMORY", error: message };
}
const coordinator = new InstallationCoordinator(database, storage);
const server = http.createServer(app);
attachSocketServer(server, coordinator, serverConfig.clientOrigin);

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, hardware: coordinator.serial.getState().status, time: new Date().toISOString() });
});

if (fs.existsSync(serverConfig.clientDistPath)) {
  app.use(express.static(serverConfig.clientDistPath));
  app.get("/{*path}", (_request, response) => response.sendFile(`${serverConfig.clientDistPath}/index.html`));
}

await coordinator.initialize();
server.listen(serverConfig.port, () => {
  console.log(`TIMEVAULT server listening on http://localhost:${serverConfig.port}`);
});

let shuttingDown = false;
function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => {
    coordinator.shutdown();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
