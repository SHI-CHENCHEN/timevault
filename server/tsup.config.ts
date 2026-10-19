import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  sourcemap: true,
  clean: true,
  noExternal: ["@timevault/shared"],
  external: ["better-sqlite3", "serialport", "@serialport/parser-readline"],
});
