import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/core": {
        target: "https://api.counterparty.io:4000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/core/, ""),
      },
      "/fx": {
        target: "https://mempool.space",
        changeOrigin: true,
        rewrite: () => "/api/v1/prices",
      },
      "/mempool": {
        target: "https://mempool.space",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/mempool/, "/api"),
      },
    },
  },
  test: {
    globals: false,
  },
});
