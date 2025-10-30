import { json } from '@sveltejs/kit';

// This endpoint provides public configuration to the client
// It runs on the server where environment variables are unmasked
export async function GET() {
  // In Netlify Functions, we MUST use process.env directly
  // SvelteKit's $env does not work reliably in Netlify Functions
  const config = {
    PUBLIC_SOCKET: process.env.PUBLIC_SOCKET || '',
    PUBLIC_DGEN_URL: process.env.PUBLIC_DGEN_URL || '',
    PUBLIC_DOMAIN: process.env.PUBLIC_DOMAIN || '',
    PUBLIC_EXPLORER: process.env.PUBLIC_EXPLORER || '',
    PUBLIC_LIQUID_EXPLORER: process.env.PUBLIC_LIQUID_EXPLORER || '',
    PUBLIC_DGEN_NETWORK: process.env.PUBLIC_DGEN_NETWORK || ''
  };
  
  // Log for debugging
  console.log('[Config API] Returning config:', {
    hasSocket: !!config.PUBLIC_SOCKET,
    hasUrl: !!config.PUBLIC_DGEN_URL,
    socketValue: config.PUBLIC_SOCKET?.substring(0, 20) + '...',
    urlValue: config.PUBLIC_DGEN_URL?.substring(0, 20) + '...'
  });
  
  // Add cache headers to reduce server load
  return json(config, {
    headers: {
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'X-Config-Source': 'server-runtime'
    }
  });
}