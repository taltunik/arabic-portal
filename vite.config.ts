import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "/arabic-portal/",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200 },
  resolve: {
    alias: {
      "grok/canvas": resolve(root, "src/shim/canvas.tsx"),
    },
  },
});
