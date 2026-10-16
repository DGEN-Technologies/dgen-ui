import netlifyAdapter from "@sveltejs/adapter-netlify";
import vercelAdapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Vercel sets VERCEL=1 on every build. Picking the adapter from it means the
// same commit deploys to both hosts with no branch-local edit to remember —
// swapping the import by hand is how a demo deploy ends up committed and
// breaking the Netlify production build.
const adapter = () =>
  process.env.VERCEL
    ? vercelAdapter({ runtime: "nodejs22.x" })
    : netlifyAdapter();

const isProd = process.env.NODE_ENV === "production";
const styleSrc = ["self", "https://fonts.googleapis.com", "unsafe-inline"];
const imgSrc = ["self", "data:", "https:"];
if (!isProd) {
  imgSrc.push("http://localhost:*");
}

const widgetApiBase =
  process.env.PUBLIC_WIDGET_API_BASE ||
  "https://widget2agent-657488364208.asia-southeast1.run.app";
if (!process.env.PUBLIC_WIDGET_API_BASE) {
  console.warn(
    "[CSP] PUBLIC_WIDGET_API_BASE missing; falling back to default widget URL",
  );
}

// The Lightning-address domain the Spark SDK registers on and then fetches
// LNURL metadata from. It MUST match src/lib/rails/spark.ts's LNURL_DOMAIN,
// including its default — the SDK's own mainnet default is breez.tips, and
// leaving that host out of connect-src blocked the metadata fetch outright,
// which surfaced as a wasm abort inside the SDK rather than a clean error.
const lnurlDomain = process.env.VITE_LNURL_DOMAIN || "breez.tips";

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
  // breez.fun is the pre-migration domain; addresses registered there still
  // resolve, so it stays alongside the current one.
  "https://breez.fun",
  `https://${lnurlDomain}`,
  // Spark rail operators. Spark signs across a threshold set of three
  // independent hosts, only one of which is a Breez domain covered by the
  // wildcard above. With the other two blocked, Lightning and on-chain BTC
  // fail outright — this is not optional connectivity.
  "https://*.spark.lightspark.com",
  "https://api.lightspark.com",
  "https://*.flashnet.xyz",
  // Spark network status, read by SparkStatusBanner. The apex redirects to
  // www, and a CSP wildcard never matches the apex, so both are listed.
  "https://spark.money",
  "https://www.spark.money",
  "https://api.sideswap.io", // PayJoin API for Breez SDK
  "wss://api.sideswap.io", // SideSwap WebSocket for swap coordination
  "wss://api-testnet.sideswap.io", // SideSwap testnet WebSocket
  "https://cloudflare-dns.com", // DNS-over-HTTPS for BIP353/Lightning address resolution
  "https://api.iconify.design",
  "https://api.simplesvg.com",
  "https://api.unisvg.com",
  "data:",
  widgetApiBase,
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
        "style-src": styleSrc, // Google Fonts; inline styles are allowed at runtime for Svelte style injection
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
        "upgrade-insecure-requests": isProd,
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
