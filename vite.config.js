import { sveltekit } from "@sveltejs/kit/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";

import path from "path";

/** @type {import('vite').UserConfig} */
const devTunnelHosts = (
  process.env.VITE_DEV_TUNNEL_HOSTS ||
  process.env.VITE_DEV_TUNNEL_HOST ||
  ""
)
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const allowedHosts = Array.from(
  new Set([
    ...devTunnelHosts,
    "survivors-clean-until-antibodies.trycloudflare.com",
    "elimination-seed-forever-citations.trycloudflare.com",
    "forwarding-employ-atlantic-guaranteed.trycloudflare.com"
  ]),
);

const config = {
  plugins: [
    sveltekit(),
    wasm(),
    topLevelAwait(),
    nodePolyfills(),
    // Only use HTTPS if explicitly enabled via environment variable
    process.env.HTTPS === "true" ? basicSsl() : null,
  ].filter(Boolean),
  resolve: {
    alias: {
      $comp: path.resolve("src/components"),
    },
  },
  preview: {
    host: "0.0.0.0",
  },
  server: {
    host: process.env.HOST || "0.0.0.0",
    port: parseInt(process.env.PORT) || 5173,
    https: process.env.HTTPS === "true" ? true : false,
    allowedHosts,
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    proxy: {
      // Proxy /api/public to /public on backend
      "/api/public": {
        target: process.env.VITE_API_URL || "http://localhost:3119",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        secure: false,
      },
      // Proxy all backend API calls but exclude UI-specific routes and public
      "/api/(?!config|backend|public)": {
        target: process.env.VITE_API_URL || "http://localhost:3119",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        secure: false,
      },
      // Only proxy specific wallet API endpoints, not UI routes
      "^/wallet/(info|generate-mnemonic|initialize|verify-backup|get-mnemonic|store-mnemonic)$":
        {
          target: process.env.VITE_API_URL || "http://localhost:3119",
          changeOrigin: true,
          secure: false,
        },
      // Proxy auth endpoints
      "/me": {
        target: process.env.VITE_API_URL || "http://localhost:3119",
        changeOrigin: true,
        secure: false,
      },
      "/accounts": {
        target: process.env.VITE_API_URL || "http://localhost:3119",
        changeOrigin: true,
        secure: false,
      },
      "/challenge": {
        target: process.env.VITE_API_URL || "http://localhost:3119",
        changeOrigin: true,
        secure: false,
      },
      // Proxy WebSocket connections
      "/ws": {
        target: process.env.VITE_WS_URL || "ws://localhost:3119",
        ws: true,
        changeOrigin: true,
      },
      // Proxy public file serving
      "/public": {
        target: process.env.VITE_API_URL || "http://localhost:3119",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ["@breeztech/breez-sdk-liquid"],
  },
};

export default config;
