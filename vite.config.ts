import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// demo site config — the published library builds via vite.lib.config.ts
// into dist/; the demo builds into site/ so the two never collide
export default defineConfig({
  plugins: [react()],
  server: { port: 5183, host: true },
  build: { outDir: "site" },
});
