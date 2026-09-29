// Minimal ambient module declarations for the two SvelteKit virtual modules
// that `src/lib/rails/liquid.ts` pulls in transitively (via `$lib/walletService`
// -> `$lib/esplora/EsploraClient` / `$lib/esplora/PollManager`).
//
// The real declarations live in the generated `.svelte-kit/ambient.d.ts`, but
// that file opens with `/// <reference types="@sveltejs/kit" />`, which pulls
// the whole `@sveltejs/kit` type surface (and its own pre-existing, unrelated
// `@opentelemetry/api` / `cookie` type errors — part of the ~185 repo-wide
// `tsc --noEmit` errors that `tsconfig.rails.json` was deliberately scoped to
// avoid) into `tsconfig.rails.json`'s narrow, rails-only program. Including it
// here would defeat that scoping. These shims describe the same runtime shape
// (see tests/stubs/env-dynamic-public.ts and app-environment.ts, used for the
// same reason under vitest) without dragging in the rest of the Kit types.
declare module "$env/dynamic/public" {
  export const env: Record<string, string | undefined>;
}

declare module "$app/environment" {
  export const browser: boolean;
  export const dev: boolean;
  export const building: boolean;
  export const version: string;
}
