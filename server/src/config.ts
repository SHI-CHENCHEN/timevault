import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = fileURLToPath(new URL("..", import.meta.url));
export const projectRoot = path.resolve(serverDirectory, "..");

function envBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function envNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const serverConfig = {
  port: envNumber(process.env.PORT, 4100),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  databasePath: path.resolve(projectRoot, process.env.DATABASE_PATH ?? "data/timevault.sqlite"),
  serialPort: process.env.SERIAL_PORT || null,
  serialAutoConnect: envBoolean(process.env.SERIAL_AUTO_CONNECT, true),
  exhibitionMode: envBoolean(process.env.EXHIBITION_MODE, false),
  processingHoldMs: envNumber(process.env.PROCESSING_HOLD_MS, 2200),
  completionHoldMs: envNumber(process.env.COMPLETION_HOLD_MS, 4000),
  clientDistPath: path.resolve(projectRoot, "client/dist"),
};
