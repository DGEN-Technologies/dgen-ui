// Stub for SvelteKit's `$app/environment` virtual module, aliased in
// vitest.config.ts for the same reason as env-dynamic-public.ts: the real
// module is only resolvable through the `sveltekit()` Vite plugin, which
// this project's vitest config does not load.
export const browser = false;
export const dev = true;
export const building = false;
export const version = "test";
