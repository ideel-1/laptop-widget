import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

// library build: `npm run build:lib` → dist/ (the published package).
// The default vite.config.ts stays the demo site.
export default defineConfig({
  plugins: [
    react(),
    dts({ include: ["src/lib"], rollupTypes: true, tsconfigPath: "./tsconfig.json" }),
  ],
  build: {
    lib: {
      entry: { index: "src/lib/index.ts", editor: "src/lib/editor.ts" },
      formats: ["es"],
    },
    rollupOptions: {
      // peers stay the consumer's — only three-bvh-csg ships as a real dep,
      // and even that resolves from their node_modules
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^three($|\/)/, "three-bvh-csg", "@react-three/fiber", "@react-three/drei"],
    },
  },
});
