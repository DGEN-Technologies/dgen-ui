import type { HandleClientError, HandleFetch } from '@sveltejs/kit';

let browserSDKEnabled = false;

export const initBrowserSDK = () => {
  browserSDKEnabled = true;
};

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  if (browserSDKEnabled && (request.url.includes('/api/') || request.url.includes('/wallet/') || request.url.includes('/payments/'))) {
    request.headers.set('x-browser-sdk', 'true');
  }
  
  return fetch(request);
};

export const handleError: HandleClientError = ({ error }) => {
  console.error('Client error:', error);
  return {
    message: 'An error occurred'
  };
};