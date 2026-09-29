// Stub for SvelteKit's `$env/dynamic/public` virtual module, aliased in
// vitest.config.ts. The real module is populated by SvelteKit's dev/build
// pipeline (server-side from process.env, client-side from a global the
// dev server injects into the page); neither exists under plain `vitest`,
// so the real specifier is unresolvable there. Code under test only needs
// `env` to exist as an object — no test exercises a code path that reads a
// specific PUBLIC_* value through this stub.
export const env: Record<string, string | undefined> = {};
