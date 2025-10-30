import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // During SSR in Netlify, ensure fetch can use relative URLs properly
  // by providing a patched fetch that prepends the origin
  if (!event.platform && event.url.origin) {
    const originalFetch = event.fetch;
    event.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input.startsWith('/')) {
        // Convert relative URL to absolute for SSR
        input = `${event.url.origin}${input}`;
      }
      return originalFetch(input, init);
    };
  }

  const response = await resolve(event);
  return response;
};