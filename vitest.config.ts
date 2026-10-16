import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: "jsdom",
    passWithNoTests: true,
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    exclude: [
      "tests/browser/**",
      "node_modules/**",
      // TODO(spark-migration): pre-existing test, never ran before Task 1
      "src/lib/secureStorage.test.ts",
    ],
  },
  resolve: {
    alias: {
      $lib: new URL("./src/lib", import.meta.url).pathname,
      // SvelteKit virtual modules that only the `sveltekit()` Vite plugin
      // can resolve — this config intentionally uses the lighter `svelte()`
      // plugin instead, so anything under test that transitively imports
      // these needs a stub. See tests/stubs/*.ts for why.
      "$env/dynamic/public": new URL(
        "./tests/stubs/env-dynamic-public.ts",
        import.meta.url,
      ).pathname,
      "$app/environment": new URL(
        "./tests/stubs/app-environment.ts",
        import.meta.url,
      ).pathname,
    },
  },
});
