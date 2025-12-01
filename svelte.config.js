import adapter from "@sveltejs/adapter-netlify";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

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
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self', 'wasm-unsafe-eval'], // wasm-unsafe-eval required for Breez SDK WebAssembly
        'style-src': ['self', 'unsafe-inline'], // Required for Svelte scoped styles
        'img-src': ['self', 'data:', 'https:', 'http://localhost:*'],
        'font-src': ['self', 'data:'],
        'connect-src': [
          'self',
          'https://*.railway.app',
          'https://*.up.railway.app',
          'wss://*.railway.app',
          'wss://*.up.railway.app',
          'ws://localhost:*',
          'https://localhost:*',
          'https://mempool.space',
          'https://liquid.network',
          'https://blockstream.info',
          'https://*.breez.technology',
          'https://*.breez.technology:*',
          'wss://*.breez.technology',
          'https://breez.fun',
          'https://api.sideswap.io', // PayJoin API for Breez SDK
          'wss://api.sideswap.io', // SideSwap WebSocket for swap coordination
          'wss://api-testnet.sideswap.io', // SideSwap testnet WebSocket
          'https://cloudflare-dns.com', // DNS-over-HTTPS for BIP353/Lightning address resolution
          'https://api.iconify.design',
          'https://api.simplesvg.com',
          'https://api.unisvg.com',
          'data:',
          'https://widget2agent-657488364208.asia-southeast1.run.app', // Chatbot endpoint
        ],
        'frame-ancestors': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
        // Security: Prevent object/embed/applet injections
        'object-src': ['none'],
        // Security: Prevent worker injections
        'worker-src': ['self', 'blob:'], // blob: needed for WASM workers
        // Security: Restrict media sources
        'media-src': ['self'],
        // Security: Prevent frame injections (iframe src)
        'frame-src': ['none'],
        // Security: Require HTTPS for all requests (upgrade insecure)
        // Disabled in development to allow localhost HTTP
        'upgrade-insecure-requests': process.env.NODE_ENV === 'production'
      }
    }
  },
  onwarn: (warning, handler) => {
    if (warning.code.includes("caption") || warning.filename.includes("Toast"))
      return;
    handler(warning);
  },
};

export default config;
