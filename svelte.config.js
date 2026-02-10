import adapter from "@sveltejs/adapter-netlify";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const isProd = process.env.NODE_ENV === "production";
const styleSrc = ["self", "https://fonts.googleapis.com"];
if (!isProd) {
  styleSrc.push("unsafe-inline");
}
const imgSrc = ["self", "data:", "https:"];
if (!isProd) {
  imgSrc.push("http://localhost:*");
}

const connectSrc = [
  "self",
  "https://*.railway.app",
  "https://*.up.railway.app",
  "wss://*.railway.app",
  "wss://*.up.railway.app",
  "https://mempool.space",
  "https://liquid.network",
  "https://blockstream.info",
  "https://*.breez.technology",
  "https://*.breez.technology:*",
  "wss://*.breez.technology",
  "https://breez.fun",
  "https://api.sideswap.io", // PayJoin API for Breez SDK
  "wss://api.sideswap.io", // SideSwap WebSocket for swap coordination
  "wss://api-testnet.sideswap.io", // SideSwap testnet WebSocket
  "https://cloudflare-dns.com", // DNS-over-HTTPS for BIP353/Lightning address resolution
  "https://api.iconify.design",
  "https://api.simplesvg.com",
  "https://api.unisvg.com",
  "data:",
  // NOTE: PUBLIC_WIDGET_API_BASE in .env must match this URL.
  // If the chatbot backend URL changes, update BOTH:
  // 1) .env(PUBLIC_WIDGET_API_BASE)
  // 2) This connect-src entry
  "https://widget2agent-657488364208.asia-southeast1.run.app",
];
if (!isProd) {
  connectSrc.push(
    "http://localhost:*",
    "ws://localhost:*",
    "https://localhost:*",
  );
}

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      "$lib/*": "./src/lib/*",
    },
    csrf: {
      checkOrigin: true, // CSRF protection enabled for security
    },
    prerender: {
      crawl: false,
      entries: [],
    },
    csp: {
      mode: "auto",
      directives: {
        "default-src": ["self"],
        "script-src": ["self", "wasm-unsafe-eval"], // wasm-unsafe-eval required for Breez SDK WebAssembly
        "style-src": styleSrc, // Google Fonts; inline styles only in development
        "img-src": imgSrc,
        "font-src": ["self", "data:", "https://fonts.gstatic.com"],
        "connect-src": connectSrc,
        "frame-ancestors": ["none"],
        "base-uri": ["self"],
        "form-action": ["self"],
        // Security: Prevent object/embed/applet injections
        "object-src": ["none"],
        // Security: Prevent worker injections
        "worker-src": ["self", "blob:"], // blob: needed for WASM workers
        // Security: Restrict media sources
        "media-src": ["self"],
        // Security: Prevent frame injections (iframe src)
        "frame-src": ["self", "https://swapspace.co/"],
        // Security: Require HTTPS for all requests (upgrade insecure)
        // Disabled in development to allow localhost HTTP
        "upgrade-insecure-requests": process.env.NODE_ENV === "production",
      },
    },
  },
  onwarn: (warning, handler) => {
    if (warning.code.includes("caption") || warning.filename.includes("Toast"))
      return;
    handler(warning);
  },
};

export default config;
