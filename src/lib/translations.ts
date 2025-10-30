// Translation module stub to fix import errors
// Re-export everything from translations/index for compatibility
export * from './translations/index';

// Add any missing exports that components expect
import { writable } from 'svelte/store';
export const loading = writable(false);