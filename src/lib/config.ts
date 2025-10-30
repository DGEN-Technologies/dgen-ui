import { browser } from '$app/environment';
import { writable } from 'svelte/store';

interface Config {
  PUBLIC_SOCKET?: string;
  PUBLIC_DGEN_URL?: string;
  PUBLIC_DOMAIN?: string;
  PUBLIC_EXPLORER?: string;
  PUBLIC_LIQUID_EXPLORER?: string;
  PUBLIC_DGEN_NETWORK?: string;
}

// Store for runtime configuration
export const runtimeConfig = writable<Config>({});

// Cache the config in sessionStorage to avoid repeated fetches
const CONFIG_CACHE_KEY = 'runtime-config';
const CONFIG_CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Fetches runtime configuration from the server
 * This bypasses Netlify's environment variable masking
 */
export async function loadRuntimeConfig(): Promise<Config> {
  if (!browser) return {};
  
  // Check cache first
  try {
    const cached = sessionStorage.getItem(CONFIG_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CONFIG_CACHE_TTL) {
        runtimeConfig.set(data);
        return data;
      }
    }
  } catch (e) {
    // Ignore cache errors
  }
  
  try {
    // Fetch fresh config from server
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      
      // Update store
      runtimeConfig.set(data);
      
      // Cache the result
      try {
        sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Ignore cache errors
      }
      
      return data;
    }
  } catch (error) {
    console.error('Failed to load runtime config:', error);
  }
  
  return {};
}

// Auto-load config when module is imported in browser
if (browser) {
  loadRuntimeConfig();
}