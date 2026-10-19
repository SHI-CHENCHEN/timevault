import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  build: {
    outDir: process.env.VITE_GITHUB_PAGES === "true" ? "../docs" : process.env.VITE_STANDALONE === "true" ? "../dist" : "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/react")) return "react";
          if (id.includes("node_modules/socket.io-client") || id.includes("node_modules/engine.io-client")) return "realtime";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:4100",
        ws: true,
      },
      "/api": "http://localhost:4100",
    },
  },
});
