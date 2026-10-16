# Spark Rail Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Lightning and on-chain Bitcoin payments by adding Breez SDK-Spark alongside the existing Liquid SDK, behind a normalized payment model so screens never choose an SDK.

**Architecture:** Two SDK adapters (`spark.ts`, `liquid.ts`) implement one interface and map their native payment types into a shared `RailPayment`. A pure `router.ts` decides which rail handles a destination or receive method. `rails/index.ts` is the only payment API the UI imports. Seed and identity handling stays in `walletService.ts`, shared by both rails.

**Tech Stack:** SvelteKit 2.47, Svelte 5 (runes), TypeScript 5.9, Vite 7, Bun, Vitest (added in Task 1), `@breeztech/breez-sdk-spark` 0.23.0, `@breeztech/breez-sdk-liquid` 0.11.7.

**Spec:** `docs/superpowers/specs/2026-08-29-spark-rail-migration-design.md`

## Global Constraints

- **Non-custodial.** Keys never leave the browser. No task may send a mnemonic, seed, private key, or derived secret to any server, log, or analytics sink.
- **One seed, two SDKs.** Both connect from the same 12-word mnemonic. No task changes key derivation, the encryption chain, or recovery.
- **Pin Spark exactly:** `"@breeztech/breez-sdk-spark": "0.23.0"` — no caret. Glow pins exactly; this SDK ships breaking changes on minor bumps.
- **Liquid is retained.** L-BTC and L-USDT send/receive must keep working. Do not remove the Liquid SDK.
- **Rail selection lives only in `src/lib/rails/router.ts`.** No component may branch on which SDK to call.
- **`bigint` never escapes an adapter.** Convert to `number` at the mapping boundary.
- **Amounts are integer sats.** Never use floats for money.
- **Package manager is `bun`.** Use `bun add`, `bun run` — never `npm` or `yarn`.
- **Formatting is enforced in CI** via `bun run lint` (Prettier). Run `bun run format` before every commit.
- **`walletService.ts` is a CI-flagged sensitive file.** Changes to it trigger a review warning. Expected for this work; keep diffs to it minimal and focused.

---

## File Structure

**Created:**

| File                                      | Responsibility                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `vitest.config.ts`                        | Test runner config                                                      |
| `src/lib/rails/types.ts`                  | `Rail`, `RailPayment`, `RailStatus`, `RailAdapter` interface. No logic. |
| `src/lib/rails/router.ts`                 | Pure rail selection: destination or receive method in, rail out.        |
| `src/lib/rails/router.test.ts`            | Router tests. No SDK, no network.                                       |
| `src/lib/rails/liquid.ts`                 | Liquid adapter. Wraps existing `walletService` internals.               |
| `src/lib/rails/liquid.test.ts`            | Liquid payment mapping tests.                                           |
| `src/lib/rails/spark.ts`                  | Spark adapter. Owns the Spark SDK instance.                             |
| `src/lib/rails/spark.test.ts`             | Spark payment mapping tests.                                            |
| `src/lib/rails/index.ts`                  | Public payment API. The only rails module the UI imports.               |
| `src/lib/stores/rails.ts`                 | Per-rail connection state, balances.                                    |
| `src/components/DepositClaims.svelte`     | Manual claim UI for deposits over the fee ceiling.                      |
| `src/components/SparkStatusBanner.svelte` | Network degradation banner.                                             |

**Modified:**

| File                                                       | Change                                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `package.json`                                             | Add vitest, jsdom, fake-indexeddb, Spark SDK; add `test` script. |
| `vite.config.js:87`                                        | Exclude Spark from dep optimization alongside Liquid.            |
| `.github/workflows/ci.yml`                                 | Run tests.                                                       |
| `src/routes/(app)/+layout.svelte`                          | Boot both rails in parallel, independent degradation.            |
| `src/lib/stores/wallet.ts`                                 | Split balance into per-rail; consume normalized events.          |
| `src/lib/transactionService.ts`                            | Store `RailPayment`; IndexedDB schema v2.                        |
| `src/lib/txErrors.ts`                                      | Add Spark error strings.                                         |
| `src/lib/sendGate.ts`                                      | Per-rail gating.                                                 |
| `src/routes/(app)/[username]/receive/+page.svelte`         | Receive via router; drop BOLT12.                                 |
| `src/routes/(app)/send/**`                                 | Send via router.                                                 |
| `src/routes/(app)/settings/lightning-address/+page.svelte` | Spark-native address registration.                               |
| `src/lib/assetService.ts`                                  | Remove unreachable `exchangeAssets`.                             |

**Deleted:** `tests/browser/wallet.spec.ts` (Task 16).

---

## Task 1: Test infrastructure

`src/lib/secureStorage.test.ts` imports from `vitest`, but vitest is not installed and `package.json` has no `test` script. That test has never run. Nothing else in this plan can be test-driven until this is fixed.

**Files:**

- Create: `vitest.config.ts`
- Modify: `package.json`, `.github/workflows/ci.yml`
- Test: `src/lib/rails/smoke.test.ts` (temporary, deleted in this task's final step)

**Interfaces:**

- Consumes: nothing
- Produces: `bun run test` runs the suite; `bun run test:watch` for iteration

- [ ] **Step 1: Install test dependencies**

```bash
bun add -d vitest@^4.0.0 jsdom@^27.0.0 fake-indexeddb@^7.0.0
```

- [ ] **Step 2: Create the vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    exclude: ["tests/browser/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      $lib: new URL("./src/lib", import.meta.url).pathname,
    },
  },
});
```

Create `vitest.setup.ts`:

```ts
import "fake-indexeddb/auto";
```

- [ ] **Step 3: Add the test scripts**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test proving the runner works**

Create `src/lib/rails/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test infrastructure", () => {
  it("runs a test", () => {
    expect(1 + 1).toBe(2);
  });

  it("provides indexedDB", () => {
    expect(typeof indexedDB).toBe("object");
  });
});
```

- [ ] **Step 5: Run it and verify it passes**

Run: `bun run test`
Expected: 2 passing tests in `smoke.test.ts`.

- [ ] **Step 6: Check the pre-existing test**

Run: `bun run test src/lib/secureStorage.test.ts`

This test has never executed, so treat its result as new information rather than a regression.

- If it passes: good, leave it.
- If it fails because Web Crypto is missing, add to `vitest.setup.ts`:

```ts
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}
```

- If it still fails for a reason specific to `secureStorage` behaviour, do **not** fix it here. Add `src/lib/secureStorage.test.ts` to the `exclude` list in `vitest.config.ts` with the comment `// TODO(spark-migration): pre-existing test, never ran before Task 1` and record the failure in the task's commit message. Fixing it is out of scope.

- [ ] **Step 7: Wire tests into CI**

In `.github/workflows/ci.yml`, insert between the "Check formatting" and "Build" steps:

```yaml
- name: Run tests
  run: bun run test
```

- [ ] **Step 8: Delete the smoke test and commit**

```bash
rm src/lib/rails/smoke.test.ts
bun run format
git add package.json bun.lock vitest.config.ts vitest.setup.ts .github/workflows/ci.yml
git commit -m "chore: add vitest test runner and wire into CI

secureStorage.test.ts imported vitest but no runner was installed and no
test script existed, so it had never run. Adds vitest with jsdom and
fake-indexeddb, plus a test step in CI."
```

---

## Task 2: Install the Spark SDK

**Files:**

- Modify: `package.json`, `vite.config.js:87`
- Test: `src/lib/rails/install.test.ts` (temporary, deleted in this task's final step)

**Interfaces:**

- Consumes: Task 1's test runner
- Produces: `@breeztech/breez-sdk-spark/web` importable; `VITE_SPARK_API_KEY` read from env

- [ ] **Step 1: Install the SDK, pinned exactly**

```bash
bun add @breeztech/breez-sdk-spark@0.23.0
```

Verify `package.json` shows `"@breeztech/breez-sdk-spark": "0.23.0"` with **no caret**. If bun added one, edit it out and re-run `bun install`.

- [ ] **Step 2: Write a failing test that the SDK's types are importable**

Create `src/lib/rails/install.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("spark sdk package", () => {
  it("exposes defaultConfig and connect from the web entry", async () => {
    const mod = await import("@breeztech/breez-sdk-spark/web");
    expect(typeof mod.defaultConfig).toBe("function");
    expect(typeof mod.connect).toBe("function");
    expect(typeof mod.getSparkStatus).toBe("function");
  });
});
```

- [ ] **Step 3: Run it**

Run: `bun run test src/lib/rails/install.test.ts`
Expected: PASS. If it fails with a module resolution error, the install did not complete — re-run `bun install`.

- [ ] **Step 4: Exclude Spark from Vite dep optimization**

In `vite.config.js`, line 87 currently reads:

```js
    exclude: ["@breeztech/breez-sdk-liquid"],
```

Change to:

```js
    exclude: ["@breeztech/breez-sdk-liquid", "@breeztech/breez-sdk-spark"],
```

WASM packages must not be pre-bundled. Glow does the same.

- [ ] **Step 5: Add the API key env var**

In `.env.example`, below the existing `VITE_BREEZ_API_KEY` line, add:

```
# Breez confirmed the existing key works for Spark. Same value as VITE_BREEZ_API_KEY.
VITE_SPARK_API_KEY=
```

In `.github/workflows/ci.yml`, add to the `env:` block of the Build step:

```yaml
VITE_SPARK_API_KEY: ci-placeholder
```

- [ ] **Step 6: Verify the build still succeeds**

Run: `bun run build`
Expected: build completes. Note the bundle size warning — Spark's WASM is large and this is expected.

- [ ] **Step 7: Delete the temp test and commit**

```bash
rm src/lib/rails/install.test.ts
bun run format
git add package.json bun.lock vite.config.js .env.example .github/workflows/ci.yml
git commit -m "chore: add breez-sdk-spark 0.23.0

Pinned exactly (no caret) — the SDK ships breaking changes on minor
version bumps and Glow pins it the same way. Excluded from Vite dep
optimization like the Liquid SDK, as WASM must not be pre-bundled."
```

---

## Task 3: The normalized model

**Files:**

- Create: `src/lib/rails/types.ts`
- Test: none (types only — no runtime behaviour to test)

**Interfaces:**

- Consumes: nothing
- Produces: `Rail`, `RailPaymentStatus`, `RailPaymentMethod`, `RailPayment`, `RailConnectionState`, `RailBalance`, `RailEvent`, `RailAdapter`

- [ ] **Step 1: Create the types module**

Create `src/lib/rails/types.ts`:

```ts
/**
 * The normalized payment vocabulary shared by both SDKs.
 *
 * Only what the UI consumes is normalized. The SDK surface is not
 * abstracted — screens that need rail-specific fields narrow on `rail`
 * and read `raw`.
 */

export type Rail = "spark" | "liquid";

export type RailPaymentStatus = "pending" | "complete" | "failed";

export type RailPaymentMethod =
  | "lightning"
  | "onchain"
  | "spark"
  | "liquid"
  | "usdt"
  /**
   * A Spark token payment. Out of scope (spec 9) and should not occur, but
   * Spark reuses one `amount: bigint` field across every payment method, and
   * for tokens that integer is in the token's own units (governed by
   * TokenMetadata.decimals), NOT sats. Mapping it into `amountSat` would
   * render 100 USDB as 1 BTC. Such payments keep this method and an
   * `amountSat` of 0 so they stay visible without displaying a fabricated
   * figure; the true amount is in `raw`.
   */
  | "token";

export interface RailPayment {
  /** Stable id. Spark: `payment.id`. Liquid: `txId`, falling back to a synthetic key. */
  id: string;
  rail: Rail;
  direction: "send" | "receive";
  status: RailPaymentStatus;
  /** Integer sats. Always positive; use `direction` for sign. */
  amountSat: number;
  feeSat: number;
  /** Unix seconds. */
  timestamp: number;
  method: RailPaymentMethod;
  /** Liquid only. Present for L-BTC and L-USDT. */
  assetId?: string;
  /** The source SDK payment, for rail-specific detail screens. */
  raw: unknown;
}

export type RailConnectionState = "connecting" | "connected" | "unavailable";

export interface RailBalance {
  rail: Rail;
  /** Integer sats. For Liquid this is the L-BTC balance. */
  balanceSat: number;
  /**
   * Liquid only: per-asset balances, including USDT.
   *
   * This shape is not free: `assetBalances` in `$lib/stores/wallet` is
   * re-pointed at this array, and five existing call sites read `.balanceSat`,
   * `.name` and `.ticker` off it (AssetBalances.svelte, SendAsset.svelte,
   * PaymentsList.svelte, send/liquid/[address]). Renaming or dropping a field
   * here silently zeroes every Liquid balance in the UI. Note the SDK's
   * AssetBalance also has an optional `balance` field — that is NOT the sats
   * figure and must not be substituted for `balanceSat`.
   */
  assets?: Array<{
    assetId: string;
    balanceSat: number;
    name?: string;
    ticker?: string;
  }>;
}

export type RailEvent =
  | { type: "synced"; rail: Rail }
  | { type: "paymentPending"; rail: Rail; payment: RailPayment }
  | { type: "paymentSucceeded"; rail: Rail; payment: RailPayment }
  | { type: "paymentFailed"; rail: Rail; payment: RailPayment }
  | { type: "balanceChanged"; rail: Rail }
  /** Spark only: on-chain deposits needing manual claim. */
  | { type: "depositsNeedClaim"; rail: "spark"; count: number };

export interface RailAdapter {
  readonly rail: Rail;
  /** `userId` lets the Liquid SDK detect account switches; Spark ignores it. */
  connect(mnemonic: string, userId?: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getBalance(): Promise<RailBalance>;
  listPayments(limit?: number): Promise<RailPayment[]>;
  onEvent(handler: (event: RailEvent) => void): Promise<string>;
  offEvent(listenerId: string): Promise<void>;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `bun run build`
Expected: build succeeds. Nothing imports this yet, so a failure here means a syntax error.

- [ ] **Step 3: Commit**

```bash
bun run format
git add src/lib/rails/types.ts
git commit -m "feat(rails): add normalized payment model

Shared vocabulary both SDK adapters map into. bigint never appears —
Spark's bigint amounts convert to number at the adapter boundary, since
max sats (2.1e15) sits well below Number.MAX_SAFE_INTEGER (9.0e15)."
```

---

## Task 4: The rail router

The highest-value test surface in this plan. Rail selection is a pure function, so every routing decision is testable without an SDK, a network, or funds.

**Files:**

- Create: `src/lib/rails/router.ts`, `src/lib/rails/router.test.ts`

**Interfaces:**

- Consumes: `Rail` from `./types`
- Produces: `railForDestination(destination: string): Rail`, `railForReceiveMethod(method: string): Rail`, `RailDecision`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/rails/router.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { railForDestination, railForReceiveMethod } from "./router";

describe("railForDestination", () => {
  it("routes bolt11 invoices to spark", () => {
    expect(railForDestination("lnbc1500n1p3xyz")).toBe("spark");
  });

  it("routes uppercase bolt11 invoices to spark", () => {
    expect(railForDestination("LNBC1500N1P3XYZ")).toBe("spark");
  });

  it("routes lightning: URIs to spark", () => {
    expect(railForDestination("lightning:lnbc1500n1p3xyz")).toBe("spark");
  });

  it("routes lightning addresses to spark", () => {
    expect(railForDestination("alice@dgen.app")).toBe("spark");
  });

  it("routes lnurl strings to spark", () => {
    expect(railForDestination("LNURL1DP68GURN8GHJ7")).toBe("spark");
  });

  it("routes bitcoin: URIs to spark", () => {
    expect(railForDestination("bitcoin:bc1qxyz?amount=0.001")).toBe("spark");
  });

  it("routes bech32 bitcoin addresses to spark", () => {
    expect(railForDestination("bc1qar0srrr7xfkvy5l643lydnw9re59gtzz")).toBe(
      "spark",
    );
  });

  it("routes legacy bitcoin addresses to spark", () => {
    expect(railForDestination("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(
      "spark",
    );
  });

  it("routes liquidnetwork: URIs to liquid", () => {
    expect(railForDestination("liquidnetwork:lq1qqxyz")).toBe("liquid");
  });

  it("routes confidential liquid addresses to liquid", () => {
    expect(railForDestination("lq1qqw508d6qejxtdg4y5r3zarvary0c5xw7k")).toBe(
      "liquid",
    );
  });

  it("routes VJL-prefixed liquid addresses to liquid", () => {
    expect(railForDestination("VJLbFVfsAJDUJfJmqQfZ5s1nnMxvDzKqRq")).toBe(
      "liquid",
    );
  });

  it("routes a lightning address whose name starts with a liquid prefix to spark", () => {
    // "vt" is a two-character Liquid prefix; usernames collide with it easily.
    expect(railForDestination("vtuber@getalby.com")).toBe("spark");
  });

  it("routes lq1-prefixed lightning addresses to spark", () => {
    expect(railForDestination("lq1user@getalby.com")).toBe("spark");
  });

  it("routes ex1-prefixed lightning addresses to spark", () => {
    expect(railForDestination("ex1ample@getalby.com")).toBe("spark");
  });

  it("trims surrounding whitespace before deciding", () => {
    expect(railForDestination("  lnbc1500n1p3xyz  ")).toBe("spark");
  });

  it("falls back to spark for unrecognised input", () => {
    expect(railForDestination("something-unrecognised")).toBe("spark");
  });

  it("falls back to spark for empty input", () => {
    expect(railForDestination("")).toBe("spark");
  });
});

describe("railForReceiveMethod", () => {
  it("routes lightning to spark", () => {
    expect(railForReceiveMethod("lightning")).toBe("spark");
  });

  it("routes bitcoin to spark", () => {
    expect(railForReceiveMethod("bitcoin")).toBe("spark");
  });

  it("routes liquid to liquid", () => {
    expect(railForReceiveMethod("liquid")).toBe("liquid");
  });

  it("routes usdt to liquid", () => {
    expect(railForReceiveMethod("usdt")).toBe("liquid");
  });

  it("falls back to spark for unknown methods", () => {
    expect(railForReceiveMethod("nonsense")).toBe("spark");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/lib/rails/router.test.ts`
Expected: FAIL — `Failed to resolve import "./router"`.

- [ ] **Step 3: Implement the router**

Create `src/lib/rails/router.ts`:

```ts
import type { Rail } from "./types";
import { sdkLogger } from "$lib/logger";

export interface RailDecision {
  rail: Rail;
  reason: string;
}

/**
 * Liquid address prefixes. Confidential addresses start `lq1` (mainnet
 * bech32) or `VJL`/`VT` (base58 confidential). Unconfidential mainnet
 * addresses start `ex1` or `H`/`G`.
 */
const LIQUID_PREFIXES = ["lq1", "ex1", "vjl", "vt"];

function decideDestination(input: string): RailDecision {
  const trimmed = (input ?? "").trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return { rail: "spark", reason: "empty input, default rail" };
  }

  if (lower.startsWith("liquidnetwork:")) {
    return { rail: "liquid", reason: "liquidnetwork URI" };
  }

  // A Liquid address never contains "@". Without this guard, a Lightning
  // address whose username begins with a Liquid prefix — vtuber@..., or any
  // name starting lq1/ex1/vjl/vt — is sent to the Liquid rail, which cannot
  // pay it. "vt" is only two characters, so this is not a remote edge case.
  if (
    !trimmed.includes("@") &&
    LIQUID_PREFIXES.some((p) => lower.startsWith(p))
  ) {
    return { rail: "liquid", reason: "liquid address prefix" };
  }

  if (lower.startsWith("lightning:") || lower.startsWith("lnbc")) {
    return { rail: "spark", reason: "bolt11 invoice" };
  }

  if (lower.startsWith("lnurl")) {
    return { rail: "spark", reason: "lnurl" };
  }

  if (lower.startsWith("bitcoin:")) {
    return { rail: "spark", reason: "bitcoin URI" };
  }

  if (trimmed.includes("@")) {
    return { rail: "spark", reason: "lightning address" };
  }

  if (
    lower.startsWith("bc1") ||
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,39}$/.test(trimmed)
  ) {
    return { rail: "spark", reason: "bitcoin address" };
  }

  return { rail: "spark", reason: "unrecognised, default rail" };
}

/**
 * Which rail should handle sending to this destination.
 *
 * Every decision is logged with its reason. When a payment goes somewhere
 * unexpected, that must be diagnosable without reproducing it.
 */
export function railForDestination(input: string): Rail {
  const decision = decideDestination(input);
  sdkLogger.info(
    `[rails] send -> ${decision.rail} (${decision.reason}), len=${(input ?? "").trim().length}`,
  );
  return decision.rail;
}

/**
 * Which rail should handle this receive method. Keys match `types` in
 * `$lib/utils`. `bolt12` is absent: Spark cannot generate BOLT12 offers,
 * and the option is removed (spec 6.2).
 */
export function railForReceiveMethod(method: string): Rail {
  const rail: Rail =
    method === "liquid" || method === "usdt" ? "liquid" : "spark";
  sdkLogger.info(`[rails] receive method="${method}" -> ${rail}`);
  return rail;
}
```

Note the ordering: Liquid checks run first because `lq1` would otherwise not be reached, and the generic `@` check runs after `lnurl` so an LNURL containing `@` is not misread as a Lightning address.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/rails/router.test.ts`
Expected: PASS — 22 tests.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/lib/rails/router.ts src/lib/rails/router.test.ts
git commit -m "feat(rails): add pure rail router

Every 'which SDK?' decision lives here and nowhere else. Pure function,
so all 22 routing cases are tested without an SDK, network, or funds.
Each decision logs its reason for post-hoc diagnosis."
```

---

## Task 5: Liquid adapter

Wraps today's `walletService` payment functions and maps Liquid payments into `RailPayment`. Behaviour is unchanged — this is a translation layer, not a rewrite.

**Files:**

- Create: `src/lib/rails/liquid.ts`, `src/lib/rails/liquid.test.ts`

**Interfaces:**

- Consumes: `RailAdapter`, `RailPayment`, `RailBalance`, `RailEvent` from `./types`
- Produces: `toRailPayment(p: unknown): RailPayment` (exported for tests), `liquidAdapter: RailAdapter`

- [ ] **Step 1: Write the failing mapping tests**

Liquid payments carry `paymentTime` (unix seconds), `paymentType`, `status`, `amountSat`, `feesSat`, `txId`, and `details`.

Create `src/lib/rails/liquid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toRailPayment } from "./liquid";

const basePayment = {
  txId: "a".repeat(64),
  paymentType: "receive",
  status: "complete",
  amountSat: 21000,
  feesSat: 150,
  paymentTime: 1756000000,
  details: { type: "liquid" },
};

describe("toRailPayment (liquid)", () => {
  it("maps core fields", () => {
    const result = toRailPayment(basePayment);
    expect(result.id).toBe("a".repeat(64));
    expect(result.rail).toBe("liquid");
    expect(result.direction).toBe("receive");
    expect(result.status).toBe("complete");
    expect(result.amountSat).toBe(21000);
    expect(result.feeSat).toBe(150);
    expect(result.timestamp).toBe(1756000000);
  });

  it("maps pending status", () => {
    const result = toRailPayment({ ...basePayment, status: "pending" });
    expect(result.status).toBe("pending");
  });

  it("maps failed status", () => {
    const result = toRailPayment({ ...basePayment, status: "failed" });
    expect(result.status).toBe("failed");
  });

  it("treats refunded as failed", () => {
    const result = toRailPayment({ ...basePayment, status: "refunded" });
    expect(result.status).toBe("failed");
  });

  it("treats unknown statuses as pending rather than dropping them", () => {
    const result = toRailPayment({
      ...basePayment,
      status: "waitingFeeAcceptance",
    });
    expect(result.status).toBe("pending");
  });

  it("maps send direction", () => {
    const result = toRailPayment({ ...basePayment, paymentType: "send" });
    expect(result.direction).toBe("send");
  });

  it("identifies usdt payments by asset id", () => {
    const result = toRailPayment({
      ...basePayment,
      details: {
        type: "liquid",
        assetId:
          "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2",
      },
    });
    expect(result.method).toBe("usdt");
    expect(result.assetId).toBe(
      "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2",
    );
  });

  it("treats L-BTC as the liquid method", () => {
    const result = toRailPayment({
      ...basePayment,
      details: {
        type: "liquid",
        assetId:
          "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d",
      },
    });
    expect(result.method).toBe("liquid");
  });

  it("synthesises an id when txId is absent", () => {
    const { txId, ...noTxId } = basePayment;
    const result = toRailPayment(noTxId);
    expect(result.id).toBe("liquid_1756000000_21000_receive");
  });

  it("defaults missing amounts to zero rather than NaN", () => {
    const result = toRailPayment({
      ...basePayment,
      amountSat: undefined,
      feesSat: undefined,
    });
    expect(result.amountSat).toBe(0);
    expect(result.feeSat).toBe(0);
  });

  it("preserves the source payment on raw", () => {
    const result = toRailPayment(basePayment);
    expect(result.raw).toBe(basePayment);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/rails/liquid.test.ts`
Expected: FAIL — `Failed to resolve import "./liquid"`.

- [ ] **Step 3: Implement the adapter**

Create `src/lib/rails/liquid.ts`:

```ts
import * as walletService from "$lib/walletService";
import { ASSET_IDS } from "$lib/assets";
import { sdkLogger } from "$lib/logger";
import type {
  RailAdapter,
  RailBalance,
  RailEvent,
  RailPayment,
  RailPaymentStatus,
  RailPaymentMethod,
} from "./types";

function mapStatus(status: unknown): RailPaymentStatus {
  switch (status) {
    case "complete":
      return "complete";
    case "failed":
    case "refunded":
      return "failed";
    default:
      // pending, waitingFeeAcceptance, waitingConfirmation and anything
      // unrecognised are all "not done yet". Never drop a payment.
      return "pending";
  }
}

function mapMethod(assetId?: string): RailPaymentMethod {
  return assetId === ASSET_IDS.USDT ? "usdt" : "liquid";
}

/** Exported for tests. Maps a Liquid SDK payment into the shared shape. */
export function toRailPayment(payment: unknown): RailPayment {
  const p = payment as Record<string, any>;
  const timestamp = Number(p.paymentTime ?? p.timestamp ?? 0);
  const amountSat = Number(p.amountSat ?? 0);
  const direction = p.paymentType === "send" ? "send" : "receive";
  const assetId: string | undefined = p.details?.assetId;

  return {
    id: p.txId || `liquid_${timestamp}_${amountSat}_${direction}`,
    rail: "liquid",
    direction,
    status: mapStatus(p.status),
    amountSat,
    feeSat: Number(p.feesSat ?? 0),
    timestamp,
    method: mapMethod(assetId),
    assetId,
    raw: payment,
  };
}

let listenerId: string | null = null;

export const liquidAdapter: RailAdapter = {
  rail: "liquid",

  async connect(mnemonic: string, userId?: string): Promise<void> {
    // userId must be forwarded: walletService uses it to detect an account
    // switch and force a config refresh. Dropping it silently reuses the
    // previous user's SDK session.
    await walletService.initWallet(mnemonic, userId);
  },

  async disconnect(): Promise<void> {
    await walletService.disconnect();
  },

  isConnected(): boolean {
    return walletService.isConnected();
  },

  async getBalance(): Promise<RailBalance> {
    const info = await walletService.getWalletInfo();
    const wallet = (info as any)?.walletInfo;
    return {
      rail: "liquid",
      balanceSat: Number(wallet?.balanceSat ?? 0),
      // Read `balanceSat` (required on the SDK's AssetBalance), never
      // `balance` (optional, and not the sats figure). Pass `name` and
      // `ticker` through — AssetBalances.svelte renders both.
      assets: (wallet?.assetBalances ?? []).map((a: any) => ({
        assetId: a.assetId,
        balanceSat: Number(a.balanceSat ?? 0),
        name: a.name,
        ticker: a.ticker,
      })),
    };
  },

  async listPayments(limit = 100): Promise<RailPayment[]> {
    const payments = await walletService.getTransactions({ limit });
    return (payments ?? []).map(toRailPayment);
  },

  async onEvent(handler: (event: RailEvent) => void): Promise<string> {
    listenerId = await walletService.addEventListener((sdkEvent: any) => {
      const payment = sdkEvent?.details
        ? toRailPayment(sdkEvent.details)
        : undefined;

      switch (sdkEvent?.type) {
        case "synced":
          handler({ type: "synced", rail: "liquid" });
          break;
        case "paymentSucceeded":
        case "paymentWaitingConfirmation":
          if (payment)
            handler({ type: "paymentSucceeded", rail: "liquid", payment });
          break;
        case "paymentPending":
        case "paymentWaitingFeeAcceptance":
          if (payment)
            handler({ type: "paymentPending", rail: "liquid", payment });
          break;
        case "paymentFailed":
        case "paymentRefundable":
          if (payment)
            handler({ type: "paymentFailed", rail: "liquid", payment });
          break;
        default:
          sdkLogger.debug(`[rails/liquid] unmapped event: ${sdkEvent?.type}`);
      }
      handler({ type: "balanceChanged", rail: "liquid" });
    });
    return listenerId;
  },

  async offEvent(id: string): Promise<void> {
    await walletService.removeEventListener(id);
    if (listenerId === id) listenerId = null;
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/rails/liquid.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/lib/rails/liquid.ts src/lib/rails/liquid.test.ts
git commit -m "feat(rails): add Liquid adapter

Translation layer over existing walletService payment calls. Unknown
statuses map to pending rather than being dropped — losing a payment
from history is worse than showing it as in-flight."
```

---

## Task 6: Spark adapter — connection lifecycle

**Files:**

- Create: `src/lib/rails/spark.ts`
- Test: covered by Task 7 (this task adds no mappable logic)

**Interfaces:**

- Consumes: `RailAdapter` from `./types`
- Produces: `sparkAdapter: RailAdapter` (payments and events land in Task 7), `getSparkNetworkStatus(): Promise<string>`

- [ ] **Step 1: Create the adapter with connection handling only**

Create `src/lib/rails/spark.ts`:

```ts
import * as sparkSdk from "@breeztech/breez-sdk-spark/web";
import init from "@breeztech/breez-sdk-spark/web";
import { sdkLogger } from "$lib/logger";
import type { RailAdapter, RailBalance, RailEvent, RailPayment } from "./types";

let sdk: sparkSdk.BreezSdk | null = null;
let wasmReady = false;
let connecting = false;

const STORAGE_DIR = "./spark_data";

async function initWasm(): Promise<void> {
  if (wasmReady) return;
  await init();
  wasmReady = true;
  sdkLogger.info("[rails/spark] wasm initialised");
}

function buildConfig(): sparkSdk.Config {
  const config = sparkSdk.defaultConfig("mainnet");

  const apiKey =
    import.meta.env.VITE_SPARK_API_KEY || import.meta.env.VITE_BREEZ_API_KEY;
  if (!apiKey) {
    throw new Error("Spark API key not found in environment variables");
  }
  config.apiKey = apiKey;

  // Lightning address domain. Breez allowlists this on request; until the
  // domain is registered, address registration will fail but payments work.
  const lnurlDomain = import.meta.env.VITE_LNURL_DOMAIN;
  if (lnurlDomain) {
    config.lnurlDomain = lnurlDomain;
  }

  // Deposits are claimed automatically up to this ceiling. The SDK default
  // is 1 sat/vbyte (~99 sats), below any provider spread, which would leave
  // deposits unclaimed whenever fees rise (spec 7). Use the recommended
  // rate at claim time instead; anything above it goes to manual claim.
  config.maxDepositClaimFee = {
    type: "networkRecommended",
    leewaySatPerVbyte: 2,
  };

  return config;
}

/**
 * Spark network health. Requires no SDK instance, so it can be called
 * before or independently of connecting. Breez's production checklist
 * requires surfacing this.
 */
export async function getSparkNetworkStatus(): Promise<sparkSdk.ServiceStatus> {
  try {
    const status = await sparkSdk.getSparkStatus();
    return status.status ?? "unknown";
  } catch (error) {
    sdkLogger.warn("[rails/spark] status check failed:", error);
    return "unknown";
  }
}

export const sparkAdapter: RailAdapter = {
  rail: "spark",

  async connect(mnemonic: string, _userId?: string): Promise<void> {
    // _userId is part of the RailAdapter contract for Liquid's benefit;
    // Spark derives its identity from the seed alone.
    if (connecting || sdk) return;
    try {
      connecting = true;
      await initWasm();
      sdk = await sparkSdk.connect({
        config: buildConfig(),
        seed: { type: "mnemonic", mnemonic },
        storageDir: STORAGE_DIR,
      });
      sdkLogger.info("[rails/spark] connected");
    } catch (error) {
      sdk = null;
      sdkLogger.error("[rails/spark] connection failed:", error);
      throw error;
    } finally {
      connecting = false;
    }
  },

  async disconnect(): Promise<void> {
    if (!sdk) return;
    await sdk.disconnect();
    sdk = null;
    sdkLogger.info("[rails/spark] disconnected");
  },

  isConnected(): boolean {
    return sdk !== null;
  },

  async getBalance(): Promise<RailBalance> {
    if (!sdk) return { rail: "spark", balanceSat: 0 };
    const info = await sdk.getInfo({});
    return { rail: "spark", balanceSat: Number(info.balanceSats ?? 0) };
  },

  async listPayments(): Promise<RailPayment[]> {
    return [];
  },

  async onEvent(): Promise<string> {
    return "";
  },

  async offEvent(): Promise<void> {},
};

/** Internal accessor for sibling modules in this directory. */
export function getSparkSdk(): sparkSdk.BreezSdk | null {
  return sdk;
}
```

`listPayments`, `onEvent`, and `offEvent` are stubs filled in by Task 7. They satisfy `RailAdapter` so the module type-checks now.

- [ ] **Step 2: Verify it builds**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 3: Add the LNURL domain env var**

In `.env.example`, add:

```
# Lightning address domain. Must be CNAMEd to breez.tips and allowlisted
# by Breez before address registration will work. Payments work without it.
VITE_LNURL_DOMAIN=
```

- [ ] **Step 4: Commit**

```bash
bun run format
git add src/lib/rails/spark.ts .env.example
git commit -m "feat(rails): add Spark adapter connection lifecycle

Sets maxDepositClaimFee to the recommended rate rather than the SDK
default of 1 sat/vbyte, which sits below any provider spread and would
strand deposits whenever fees rise."
```

---

## Task 7: Spark adapter — payments and events

**Files:**

- Modify: `src/lib/rails/spark.ts`
- Create: `src/lib/rails/spark.test.ts`

**Interfaces:**

- Consumes: `getSparkSdk` from Task 6
- Produces: `toRailPayment(p: unknown): RailPayment` exported from `./spark`; working `listPayments`, `onEvent`, `offEvent`

- [ ] **Step 1: Write the failing mapping tests**

Spark payments carry `id`, `paymentType` (`send`/`receive`), `status` (`completed`/`pending`/`failed`), `amount` and `fees` as **bigint**, `timestamp`, and `method`.

Create `src/lib/rails/spark.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toRailPayment } from "./spark";

const basePayment = {
  id: "spark-payment-1",
  paymentType: "receive",
  status: "completed",
  amount: 21000n,
  fees: 52n,
  timestamp: 1756000000,
  method: "lightning",
  details: { type: "lightning", invoice: "lnbc1500n1p3xyz" },
};

describe("toRailPayment (spark)", () => {
  it("maps core fields", () => {
    const result = toRailPayment(basePayment);
    expect(result.id).toBe("spark-payment-1");
    expect(result.rail).toBe("spark");
    expect(result.direction).toBe("receive");
    expect(result.status).toBe("complete");
    expect(result.timestamp).toBe(1756000000);
  });

  it("converts bigint amounts to number", () => {
    const result = toRailPayment(basePayment);
    expect(result.amountSat).toBe(21000);
    expect(typeof result.amountSat).toBe("number");
    expect(result.feeSat).toBe(52);
    expect(typeof result.feeSat).toBe("number");
  });

  it("converts the largest realistic balance without precision loss", () => {
    // 21M BTC in sats — the entire supply, far above any real balance.
    const result = toRailPayment({
      ...basePayment,
      amount: 2_100_000_000_000_000n,
    });
    expect(result.amountSat).toBe(2_100_000_000_000_000);
    expect(Number.isSafeInteger(result.amountSat)).toBe(true);
  });

  it("maps completed to complete", () => {
    expect(toRailPayment(basePayment).status).toBe("complete");
  });

  it("maps pending", () => {
    expect(toRailPayment({ ...basePayment, status: "pending" }).status).toBe(
      "pending",
    );
  });

  it("maps failed", () => {
    expect(toRailPayment({ ...basePayment, status: "failed" }).status).toBe(
      "failed",
    );
  });

  it("maps unknown statuses to pending rather than dropping them", () => {
    expect(toRailPayment({ ...basePayment, status: "weird" }).status).toBe(
      "pending",
    );
  });

  it("maps send direction", () => {
    expect(
      toRailPayment({ ...basePayment, paymentType: "send" }).direction,
    ).toBe("send");
  });

  it("maps deposit method to onchain", () => {
    expect(toRailPayment({ ...basePayment, method: "deposit" }).method).toBe(
      "onchain",
    );
  });

  it("maps withdraw method to onchain", () => {
    expect(toRailPayment({ ...basePayment, method: "withdraw" }).method).toBe(
      "onchain",
    );
  });

  it("maps spark method to spark", () => {
    expect(toRailPayment({ ...basePayment, method: "spark" }).method).toBe(
      "spark",
    );
  });

  it("maps token payments to the token method, not spark", () => {
    expect(toRailPayment({ ...basePayment, method: "token" }).method).toBe(
      "token",
    );
  });

  it("reports zero sats for a token payment rather than its raw units", () => {
    // 100 USDB at 6 decimals is 100_000_000 in native units. Reporting that
    // as sats would show 1 BTC.
    const result = toRailPayment({
      ...basePayment,
      method: "token",
      amount: 100_000_000n,
      fees: 1_000n,
    });
    expect(result.amountSat).toBe(0);
    expect(result.feeSat).toBe(0);
    expect(result.raw).toMatchObject({ amount: 100_000_000n });
  });

  it("maps unknown methods to lightning, the common path", () => {
    expect(toRailPayment({ ...basePayment, method: "unknown" }).method).toBe(
      "lightning",
    );
  });

  it("handles missing amounts without producing NaN", () => {
    const result = toRailPayment({
      ...basePayment,
      amount: undefined,
      fees: undefined,
    });
    expect(result.amountSat).toBe(0);
    expect(result.feeSat).toBe(0);
  });

  it("preserves the source payment on raw", () => {
    expect(toRailPayment(basePayment).raw).toBe(basePayment);
  });

  it("never lets bigint escape onto the normalized shape", () => {
    const result = toRailPayment(basePayment);
    for (const value of Object.values(result)) {
      expect(typeof value).not.toBe("bigint");
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/rails/spark.test.ts`
Expected: FAIL — `toRailPayment` is not exported from `./spark`.

- [ ] **Step 3: Add mapping and event handling**

In `src/lib/rails/spark.ts`, add these imports to the existing import block:

```ts
import type { RailPaymentStatus, RailPaymentMethod } from "./types";
```

Then add above `export const sparkAdapter`:

```ts
function mapStatus(status: unknown): RailPaymentStatus {
  switch (status) {
    case "completed":
      return "complete";
    case "failed":
      return "failed";
    default:
      // pending and anything unrecognised. Never drop a payment.
      return "pending";
  }
}

function mapMethod(method: unknown): RailPaymentMethod {
  switch (method) {
    case "deposit":
    case "withdraw":
      return "onchain";
    case "spark":
      return "spark";
    case "token":
      return "token";
    default:
      return "lightning";
  }
}

/**
 * Exported for tests. Maps a Spark SDK payment into the shared shape.
 *
 * Spark returns bigint amounts; they convert to number here and nowhere
 * else. Max possible sats (2.1e15) is well inside Number.MAX_SAFE_INTEGER
 * (9.0e15), so this is lossless for any real balance.
 */
export function toRailPayment(payment: unknown): RailPayment {
  const p = payment as Record<string, any>;
  const method = mapMethod(p.method);

  // Spark reuses one `amount` field for every method, but a token payment's
  // amount is in the token's own units, not sats. Reporting it as sats would
  // render 100 USDB as 1 BTC. Tokens are out of scope (spec 9) and should
  // never appear; if one does, keep it visible with a zero amount and the
  // true value in `raw` rather than displaying a fabricated figure.
  const isToken = method === "token";
  if (isToken) {
    sdkLogger.warn(
      `[rails/spark] token payment ${p.id} — amount not in sats, reporting 0`,
    );
  }

  return {
    id: String(p.id ?? ""),
    rail: "spark",
    direction: p.paymentType === "send" ? "send" : "receive",
    status: mapStatus(p.status),
    amountSat: isToken ? 0 : Number(p.amount ?? 0),
    feeSat: isToken ? 0 : Number(p.fees ?? 0),
    timestamp: Number(p.timestamp ?? 0),
    method,
    raw: payment,
  };
}
```

Now replace the three stub methods on `sparkAdapter`:

```ts
  async listPayments(limit = 100): Promise<RailPayment[]> {
    if (!sdk) return [];
    const response = await sdk.listPayments({ limit });
    return (response.payments ?? []).map(toRailPayment);
  },

  async onEvent(handler: (event: RailEvent) => void): Promise<string> {
    if (!sdk) throw new Error("Spark SDK not connected");
    return await sdk.addEventListener({
      onEvent: (event: sparkSdk.SdkEvent) => {
        switch (event.type) {
          case "synced":
            handler({ type: "synced", rail: "spark" });
            break;
          case "paymentSucceeded":
            handler({
              type: "paymentSucceeded",
              rail: "spark",
              payment: toRailPayment(event.payment),
            });
            break;
          case "paymentPending":
            handler({
              type: "paymentPending",
              rail: "spark",
              payment: toRailPayment(event.payment),
            });
            break;
          case "paymentFailed":
            handler({
              type: "paymentFailed",
              rail: "spark",
              payment: toRailPayment(event.payment),
            });
            break;
          case "unclaimedDeposits":
            handler({
              type: "depositsNeedClaim",
              rail: "spark",
              count: event.unclaimedDeposits?.length ?? 0,
            });
            break;
          case "claimedDeposits":
          case "newDeposits":
            break;
          default:
            sdkLogger.debug(`[rails/spark] unmapped event: ${event.type}`);
        }
        handler({ type: "balanceChanged", rail: "spark" });
      },
    });
  },

  async offEvent(id: string): Promise<void> {
    if (!sdk || !id) return;
    await sdk.removeEventListener(id);
  },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/rails/spark.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 5: Run the whole suite**

Run: `bun run test`
Expected: all tests pass — router, liquid, spark.

- [ ] **Step 6: Commit**

```bash
bun run format
git add src/lib/rails/spark.ts src/lib/rails/spark.test.ts
git commit -m "feat(rails): add Spark payment mapping and events

bigint converts to number here and nowhere else — a test asserts no
bigint escapes onto the normalized shape, since one leaking into a
Svelte template throws at render time."
```

---

## Task 8: Public rails API

The single module screens import. Owns send/receive dispatch by delegating the rail decision to `router.ts`.

**Files:**

- Create: `src/lib/rails/index.ts`

**Interfaces:**

- Consumes: `railForDestination`, `railForReceiveMethod` from `./router`; `sparkAdapter`, `liquidAdapter`
- Produces: `adapterFor(rail)`, `adapters`, `connectRails(mnemonic)`, `disconnectRails()`, `prepareSend(destination, amountSat?)`, `sendPayment(prepared)`, `createReceiveRequest(method, opts)`, `allPayments(limit?)`, `subscribeRails(handler)`, `PreparedSend`

- [ ] **Step 1: Create the public API**

Create `src/lib/rails/index.ts`:

```ts
import {
  sparkAdapter,
  getSparkSdk,
  toRailPayment as toSparkPayment,
} from "./spark";
import { liquidAdapter, toRailPayment as toLiquidPayment } from "./liquid";
import { railForDestination, railForReceiveMethod } from "./router";
import * as walletService from "$lib/walletService";
import { sdkLogger } from "$lib/logger";
import { waitForOutgoingSlot, trackOutgoingTx } from "$lib/sendGate";
import type { Rail, RailAdapter, RailEvent, RailPayment } from "./types";

export * from "./types";
export { railForDestination, railForReceiveMethod } from "./router";
export { getSparkNetworkStatus } from "./spark";

export const adapters: Record<Rail, RailAdapter> = {
  spark: sparkAdapter,
  liquid: liquidAdapter,
};

export function adapterFor(rail: Rail): RailAdapter {
  return adapters[rail];
}

/**
 * Connect both rails in parallel, degrading independently.
 *
 * The wallet must never be dead because the less-used rail failed, so a
 * rejection on one side is logged and swallowed rather than propagated.
 * Callers read each rail's state via `isConnected()`.
 */
export async function connectRails(
  mnemonic: string,
  userId?: string,
): Promise<void> {
  const results = await Promise.allSettled([
    sparkAdapter.connect(mnemonic, userId),
    liquidAdapter.connect(mnemonic, userId),
  ]);

  results.forEach((result, i) => {
    const rail = i === 0 ? "spark" : "liquid";
    if (result.status === "rejected") {
      sdkLogger.error(`[rails] ${rail} failed to connect:`, result.reason);
    }
  });

  if (results.every((r) => r.status === "rejected")) {
    throw new Error("Both payment rails failed to connect");
  }
}

export async function disconnectRails(): Promise<void> {
  await Promise.allSettled([
    sparkAdapter.disconnect(),
    liquidAdapter.disconnect(),
  ]);
}

export interface PreparedSend {
  rail: Rail;
  amountSat: number;
  feeSat: number;
  destination: string;
  /** Rail-specific prepare response, passed straight back to sendPayment. */
  raw: unknown;
}

/**
 * Prepare a payment. The rail is chosen from the destination; callers
 * never pick.
 */
export async function prepareSend(
  destination: string,
  amountSat?: number,
): Promise<PreparedSend> {
  const rail = railForDestination(destination);

  if (rail === "spark") {
    const sdk = getSparkSdk();
    if (!sdk) throw new Error("Spark rail unavailable");
    const prepared = await sdk.prepareSendPayment({
      paymentRequest: { type: "input", input: destination.trim() },
      amount: amountSat !== undefined ? BigInt(amountSat) : undefined,
    });
    const method = prepared.paymentMethod as any;
    const feeSat = Number(
      method?.lightningFeeSats ??
        method?.fee ??
        method?.sparkTransferFeeSats ??
        0,
    );
    return {
      rail,
      amountSat: Number(prepared.amount ?? 0),
      feeSat,
      destination,
      raw: prepared,
    };
  }

  const prepared = await walletService.prepareSendPayment({
    destination: destination.trim(),
    amount:
      amountSat !== undefined
        ? { type: "bitcoin", receiverAmountSat: amountSat }
        : undefined,
  } as any);

  return {
    rail,
    amountSat: Number(
      (prepared as any)?.amount?.receiverAmountSat ?? amountSat ?? 0,
    ),
    feeSat: Number((prepared as any)?.feesSat ?? 0),
    destination,
    raw: prepared,
  };
}

/**
 * Execute a prepared payment.
 *
 * The send gate is per-rail. Liquid keeps the existing UTXO-conflict gate;
 * Spark is not UTXO-based, so gating it there would slow Lightning for no
 * benefit.
 */
export async function sendPayment(
  prepared: PreparedSend,
): Promise<RailPayment> {
  if (prepared.rail === "spark") {
    const sdk = getSparkSdk();
    if (!sdk) throw new Error("Spark rail unavailable");
    const response = await sdk.sendPayment({
      prepareResponse: prepared.raw as any,
    });
    return toSparkPayment(response.payment);
  }

  await waitForOutgoingSlot();
  const response = await walletService.sendPayment({
    prepareResponse: prepared.raw,
  } as any);
  const txId = (response as any)?.payment?.txId;
  if (typeof txId === "string" && /^[a-fA-F0-9]{64}$/.test(txId)) {
    trackOutgoingTx(txId, "liquid");
  }
  return toLiquidPayment((response as any).payment);
}

export interface ReceiveRequest {
  rail: Rail;
  /** The invoice, address, or URI to display. */
  destination: string;
  feeSat: number;
}

/**
 * Create a receive request. `method` matches the keys in `types` from
 * `$lib/utils`: lightning, bitcoin, liquid, usdt.
 */
export async function createReceiveRequest(
  method: string,
  opts: { amountSat?: number; description?: string; assetId?: string } = {},
): Promise<ReceiveRequest> {
  const rail = railForReceiveMethod(method);

  if (rail === "spark") {
    const sdk = getSparkSdk();
    if (!sdk) throw new Error("Spark rail unavailable");

    const paymentMethod =
      method === "bitcoin"
        ? ({ type: "bitcoinAddress" } as const)
        : ({
            type: "bolt11Invoice",
            description: opts.description ?? "",
            amountSats: opts.amountSat,
          } as const);

    const response = await sdk.receivePayment({ paymentMethod });
    return {
      rail,
      destination: response.paymentRequest,
      feeSat: Number(response.fee ?? 0),
    };
  }

  const prepared = await walletService.prepareReceivePayment({
    paymentMethod: "liquidAddress",
    amount: opts.assetId
      ? { type: "asset", assetId: opts.assetId, payerAmount: opts.amountSat }
      : undefined,
  } as any);
  const response = await walletService.receivePayment({
    prepareResponse: prepared,
    description: opts.description,
  } as any);

  return {
    rail,
    destination: (response as any).destination,
    feeSat: Number((prepared as any)?.feesSat ?? 0),
  };
}

/**
 * Payments from both rails, merged and sorted newest first.
 *
 * A failing rail contributes nothing rather than failing the whole list —
 * a user with a degraded rail should still see the other rail's history.
 */
export async function allPayments(limit = 100): Promise<RailPayment[]> {
  const results = await Promise.allSettled([
    sparkAdapter.isConnected()
      ? sparkAdapter.listPayments(limit)
      : Promise.resolve([]),
    liquidAdapter.isConnected()
      ? liquidAdapter.listPayments(limit)
      : Promise.resolve([]),
  ]);

  const payments: RailPayment[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      payments.push(...result.value);
    } else {
      sdkLogger.warn(
        "[rails] listPayments failed for one rail:",
        result.reason,
      );
    }
  }

  return payments.sort((a, b) => b.timestamp - a.timestamp);
}

/** Subscribe to events from both rails. Returns a cleanup function. */
export async function subscribeRails(
  handler: (event: RailEvent) => void,
): Promise<() => Promise<void>> {
  const ids: Array<{ rail: Rail; id: string }> = [];

  for (const adapter of [sparkAdapter, liquidAdapter]) {
    if (!adapter.isConnected()) continue;
    try {
      const id = await adapter.onEvent(handler);
      ids.push({ rail: adapter.rail, id });
    } catch (error) {
      sdkLogger.error(`[rails] ${adapter.rail} listener failed:`, error);
    }
  }

  return async () => {
    for (const { rail, id } of ids) {
      try {
        await adapters[rail].offEvent(id);
      } catch (error) {
        sdkLogger.warn(`[rails] ${rail} listener cleanup failed:`, error);
      }
    }
  };
}
```

- [ ] **Step 2: Verify the build**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 3: Run the suite**

Run: `bun run test`
Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
bun run format
git add src/lib/rails/index.ts
git commit -m "feat(rails): add public rails API

Screens import only this module. Rails connect in parallel and degrade
independently — one rail failing must not produce a dead wallet. The
send gate stays Liquid-only, since Spark is not UTXO-based."
```

---

## Task 9: Per-rail state store

**Files:**

- Create: `src/lib/stores/rails.ts`

**Interfaces:**

- Consumes: `RailConnectionState`, `RailEvent`, `adapters` from `$lib/rails`
- Produces: `railState` store, `sparkBalance`, `liquidBalance`, `liquidAssets`, `sparkAvailable`, `liquidAvailable`, `unclaimedDepositCount`, `refreshBalances()`, `setRailState(rail, state)`

- [ ] **Step 1: Create the store**

Create `src/lib/stores/rails.ts`:

```ts
import { writable, derived, get } from "svelte/store";
import { adapters } from "$lib/rails";
import type { Rail, RailConnectionState } from "$lib/rails/types";
import { sdkLogger } from "$lib/logger";

interface RailSlice {
  state: RailConnectionState;
  balanceSat: number;
  assets: Array<{ assetId: string; balance: number }>;
}

interface RailsState {
  spark: RailSlice;
  liquid: RailSlice;
  unclaimedDeposits: number;
}

const initial: RailsState = {
  spark: { state: "connecting", balanceSat: 0, assets: [] },
  liquid: { state: "connecting", balanceSat: 0, assets: [] },
  unclaimedDeposits: 0,
};

export const railState = writable<RailsState>(initial);

export function setRailState(rail: Rail, state: RailConnectionState): void {
  railState.update((s) => ({ ...s, [rail]: { ...s[rail], state } }));
}

export function setUnclaimedDeposits(count: number): void {
  railState.update((s) => ({ ...s, unclaimedDeposits: count }));
}

/** Refresh both balances. A failing rail leaves its last known value. */
export async function refreshBalances(): Promise<void> {
  for (const rail of ["spark", "liquid"] as Rail[]) {
    const adapter = adapters[rail];
    if (!adapter.isConnected()) continue;
    try {
      const balance = await adapter.getBalance();
      railState.update((s) => ({
        ...s,
        [rail]: {
          ...s[rail],
          state: "connected",
          balanceSat: balance.balanceSat,
          assets: balance.assets ?? [],
        },
      }));
    } catch (error) {
      sdkLogger.warn(`[rails] balance refresh failed for ${rail}:`, error);
    }
  }
}

export const sparkBalance = derived(railState, ($s) => $s.spark.balanceSat);
export const liquidBalance = derived(railState, ($s) => $s.liquid.balanceSat);
export const liquidAssets = derived(railState, ($s) => $s.liquid.assets);
export const sparkAvailable = derived(
  railState,
  ($s) => $s.spark.state === "connected",
);
export const liquidAvailable = derived(
  railState,
  ($s) => $s.liquid.state === "connected",
);
export const unclaimedDepositCount = derived(
  railState,
  ($s) => $s.unclaimedDeposits,
);
```

- [ ] **Step 2: Re-point the existing balance stores**

`walletBalance` and `assetBalances` are exported from `src/lib/stores/wallet.ts` and consumed by `PaymentsList.svelte`, `Balance.svelte`, `SendAsset.svelte`, `AssetBalances.svelte`, and `Account.svelte`. After Task 10 the wallet store is no longer fed by SDK events, so those five components would show a frozen balance.

Do **not** leave two sources of balance truth. In `src/lib/stores/wallet.ts`, replace the bodies of the two derived stores so they read from `railState`, keeping the export names exactly as they are:

```ts
import { railState } from "./rails";

// Spendable Bitcoin lives on the Spark rail. Liquid balances are separate
// and surfaced through `assetBalances` (spec 5).
export const walletBalance = derived(railState, ($r) => $r.spark.balanceSat);

export const assetBalances = derived(railState, ($r) => $r.liquid.assets);
```

Remove the now-unused `walletInfo`-based derivations that fed them. Leave every other export in the file alone.

- [ ] **Step 3: Verify no component changed**

Run: `git diff --name-only`
Expected: only `src/lib/stores/rails.ts` and `src/lib/stores/wallet.ts`. If anything under `src/components/` appears, the export names drifted — restore them.

Then confirm the asset shape survived, since five call sites depend on it:

Run: `grep -rn "balanceSat" src/components/AssetBalances.svelte src/components/SendAsset.svelte src/components/PaymentsList.svelte`
Expected: unchanged hits. Those components read `.balanceSat`, `.name` and `.ticker` off each entry of `assetBalances`. If the array you now supply lacks any of those keys, every Liquid balance renders as 0 with no error.

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
bun run format
git add src/lib/stores/rails.ts src/lib/stores/wallet.ts
git commit -m "feat(rails): add per-rail state store

Separate balances per spec 5 — a blended figure would let a user see a
total and then be refused for insufficient funds on a Lightning payment.

walletBalance and assetBalances are re-pointed at the new store rather
than duplicated, so the five components consuming them keep working
unchanged and there is one source of balance truth."
```

---

## Task 10: Boot both rails

**Files:**

- Modify: `src/routes/(app)/+layout.svelte`

**Interfaces:**

- Consumes: `connectRails`, `subscribeRails`, `adapters` from `$lib/rails`; `setRailState`, `refreshBalances`, `setUnclaimedDeposits` from `$lib/stores/rails`
- Produces: both rails connected at boot; rail events feeding the store

- [ ] **Step 1: Read the current boot sequence**

Run: `grep -n "initWallet\|addEventListener\|walletEventListenerId" "src/routes/(app)/+layout.svelte"`

Lines around 189, 218, and 241 hold the current single-SDK boot: `walletService.initWallet(mnemonic, userId)` followed by `walletService.addEventListener(...)`. The tab lock, password, and mnemonic retrieval above them are unchanged — they are seed concerns, shared by both rails.

- [ ] **Step 2: Add the rails imports**

Near the existing `import * as walletService from "$lib/walletService";` add:

```ts
import { connectRails, subscribeRails, adapters } from "$lib/rails";
import {
  setRailState,
  refreshBalances,
  setUnclaimedDeposits,
} from "$lib/stores/rails";
```

- [ ] **Step 3: Replace each initWallet call**

Both `await walletService.initWallet(mnemonic, userId);` calls (around lines 189 and 218) become:

```ts
await connectRails(mnemonic, userId);
setRailState(
  "spark",
  adapters.spark.isConnected() ? "connected" : "unavailable",
);
setRailState(
  "liquid",
  adapters.liquid.isConnected() ? "connected" : "unavailable",
);
await refreshBalances();
```

`connectRails` only throws when **both** rails fail, so the existing error handling around these calls still means "the wallet could not start" and needs no change.

- [ ] **Step 4: Replace the event listener registration**

The existing `walletEventListenerId = await walletService.addEventListener(...)` block (around line 241) becomes:

```ts
railsUnsubscribe = await subscribeRails((event) => {
  if (event.type === "depositsNeedClaim") {
    setUnclaimedDeposits(event.count);
    return;
  }
  if (event.type === "balanceChanged" || event.type === "synced") {
    void refreshBalances();
    return;
  }
  if (
    event.type === "paymentSucceeded" ||
    event.type === "paymentPending" ||
    event.type === "paymentFailed"
  ) {
    void refreshBalances();
    notifyPaymentReceived(
      event.payment.raw,
      event.type === "paymentSucceeded" ? "confirmed" : "pending",
    );
  }
});
```

Declare alongside the other component state:

```ts
let railsUnsubscribe: (() => Promise<void>) | null = null;
```

Keep the existing `notifyPaymentReceived` import. If `walletEventListenerId` becomes unused, remove its declaration.

- [ ] **Step 5: Update cleanup**

Wherever `walletService.removeEventListener` was called on teardown, use:

```ts
if (railsUnsubscribe) {
  await railsUnsubscribe();
  railsUnsubscribe = null;
}
```

Leave `walletService.disconnect()` calls alone for now; Task 16 revisits them.

- [ ] **Step 6: Verify the build and suite**

Run: `bun run build && bun run test`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
bun run format
git add "src/routes/(app)/+layout.svelte"
git commit -m "feat(rails): boot both rails in parallel

Rails connect concurrently and degrade independently; boot only fails if
both fail. Seed retrieval, tab locking, and password handling above this
point are unchanged — they are shared, not rail-specific."
```

---

## Task 11: Merged history and cache schema

**Files:**

- Modify: `src/lib/transactionService.ts:48-75` (the `TransactionCache` class), `src/lib/stores/wallet.ts`
- Create: `src/lib/rails/history.test.ts`

**Interfaces:**

- Consumes: `allPayments`, `RailPayment` from `$lib/rails`
- Produces: `mergePayments(a: RailPayment[], b: RailPayment[]): RailPayment[]` exported from `$lib/rails/index`

- [ ] **Step 1: Write the failing merge tests**

Create `src/lib/rails/history.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergePayments } from "./index";
import type { RailPayment } from "./types";

function payment(over: Partial<RailPayment>): RailPayment {
  return {
    id: "x",
    rail: "spark",
    direction: "receive",
    status: "complete",
    amountSat: 1000,
    feeSat: 0,
    timestamp: 1756000000,
    method: "lightning",
    raw: {},
    ...over,
  };
}

describe("mergePayments", () => {
  it("sorts newest first across both rails", () => {
    const spark = [payment({ id: "s1", timestamp: 200 })];
    const liquid = [payment({ id: "l1", rail: "liquid", timestamp: 300 })];
    const merged = mergePayments(spark, liquid);
    expect(merged.map((p) => p.id)).toEqual(["l1", "s1"]);
  });

  it("keeps both rails' payments", () => {
    const merged = mergePayments(
      [payment({ id: "s1" })],
      [payment({ id: "l1", rail: "liquid" })],
    );
    expect(merged).toHaveLength(2);
  });

  it("deduplicates by rail and id, not id alone", () => {
    const merged = mergePayments(
      [payment({ id: "same" })],
      [payment({ id: "same", rail: "liquid" })],
    );
    expect(merged).toHaveLength(2);
  });

  it("removes true duplicates within one rail", () => {
    const merged = mergePayments(
      [payment({ id: "dup" }), payment({ id: "dup" })],
      [],
    );
    expect(merged).toHaveLength(1);
  });

  it("handles empty input", () => {
    expect(mergePayments([], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/rails/history.test.ts`
Expected: FAIL — `mergePayments` is not exported.

- [ ] **Step 3: Implement the merge**

Add to `src/lib/rails/index.ts`:

```ts
/**
 * Merge two rails' payments, newest first.
 *
 * Deduplication is keyed on `rail:id`, never `id` alone: the two SDKs
 * mint ids independently and a collision across rails is two different
 * payments, not one.
 */
export function mergePayments(
  a: RailPayment[],
  b: RailPayment[],
): RailPayment[] {
  const seen = new Map<string, RailPayment>();
  for (const payment of [...a, ...b]) {
    seen.set(`${payment.rail}:${payment.id}`, payment);
  }
  return [...seen.values()].sort((x, y) => y.timestamp - x.timestamp);
}
```

Then simplify `allPayments` to use it, replacing its sort:

```ts
const [sparkResult, liquidResult] = results;
const sparkPayments =
  sparkResult.status === "fulfilled" ? sparkResult.value : [];
const liquidPayments =
  liquidResult.status === "fulfilled" ? liquidResult.value : [];
return mergePayments(sparkPayments, liquidPayments);
```

Keep the existing `sdkLogger.warn` for rejected results.

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/rails/history.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Bump the IndexedDB schema**

In `src/lib/transactionService.ts`, the cache opens `dgen_transactions` at version 1 with indexes on Liquid field names (`paymentTime`, `paymentType`, `amountSat`).

Change the version and rebuild the store for `RailPayment`:

```ts
const request = indexedDB.open(this.dbName, 2);
```

And replace the `onupgradeneeded` handler:

```ts
request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result;
  // v2 stores RailPayment. The cache holds derived data only, so the
  // upgrade drops and rebuilds rather than migrating field names.
  if (db.objectStoreNames.contains(this.storeName)) {
    db.deleteObjectStore(this.storeName);
  }
  const store = db.createObjectStore(this.storeName, { keyPath: "id" });
  store.createIndex("timestamp", "timestamp");
  store.createIndex("direction", "direction");
  store.createIndex("status", "status");
  store.createIndex("amountSat", "amountSat");
  store.createIndex("rail", "rail");
};
```

- [ ] **Step 6: Point the transactions store at both rails**

In `src/lib/stores/wallet.ts`, the transactions store loads via `walletService.getTransactions`. Replace that call with:

```ts
const payments = await allPayments(limit);
```

adding `import { allPayments } from "$lib/rails";` at the top. Field references downstream change from Liquid names to the normalized ones: `paymentTime` becomes `timestamp`, `paymentType` becomes `direction`, `feesSat` becomes `feeSat`.

Search the WHOLE tree, not just those two files — the renamed fields are read from components too:

Run: `grep -rn "paymentTime\|paymentType\|feesSat" src/ --include=*.ts --include=*.svelte`

`src/components/PaymentsList.svelte` is the one that matters most and is easy to miss. It imports from `$lib/transactionService` and reads, off each payment object:

| Field                 | Reads                                 | Becomes                                                                        |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| `payment.paymentType` | 5 (lines ~276, 279, 1086, 1087, 1103) | `payment.direction`                                                            |
| `payment.paymentTime` | 1 (line ~285)                         | `payment.timestamp`                                                            |
| `payment.feesSat`     | 2 (lines ~1114, 1116)                 | `payment.feeSat`                                                               |
| `payment.amountSat`   | 2                                     | unchanged                                                                      |
| `payment.status`      | 6                                     | unchanged name, but the value set narrows to `pending` / `complete` / `failed` |

If these are missed, nothing throws: `payment.paymentType` becomes `undefined`, so `=== "receive"` is false and **every payment renders as a send with a negative amount**, the date column breaks, and fees display blank. Verify by grepping for zero remaining hits after the edit.

Note the local variable `paymentTypeLabel` in that file is unrelated — it is a display string, not a field read. Leave it alone.

- [ ] **Step 7: Verify build and suite**

Run: `bun run build && bun run test`
Expected: both succeed.

- [ ] **Step 8: Commit**

```bash
bun run format
git add src/lib/rails/index.ts src/lib/rails/history.test.ts src/lib/transactionService.ts src/lib/stores/wallet.ts
git commit -m "feat(rails): merge history across rails, bump cache to v2

Dedup keys on rail:id rather than id alone — the SDKs mint ids
independently, so a cross-rail collision is two payments, not one.
Cache holds derived data, so v2 drops and rebuilds."
```

---

## Task 12: Send screens

**Files:**

- Modify: `src/routes/(app)/send/[...text]/+page.svelte`, `src/routes/(app)/send/bitcoin/[address]/[amount]/[...feeRate]/+page.svelte`, `src/routes/(app)/send/liquid/[address]/+page.svelte`, `src/routes/(app)/send/liquid/[address]/[amount]/+page.svelte`, `src/components/SendLightning.svelte`, `src/lib/parse.ts`

**Interfaces:**

- Consumes: `prepareSend`, `sendPayment`, `PreparedSend` from `$lib/rails`
- Produces: send flows routed by destination

- [ ] **Step 1: Find every send call site**

Run:

```bash
grep -rn "walletService.prepareSendPayment\|walletService.sendPayment\|walletService.payOnchain\|walletService.preparePayOnchain\|walletService.lnurlPay\|walletService.prepareLnurlPay" src/
```

Every hit is a call site to convert. Work through them one at a time, running `bun run build` after each.

- [ ] **Step 2: Convert each call site**

The pattern is the same everywhere. Replace:

```ts
const prepared = await walletService.prepareSendPayment({
  destination,
  amount,
});
const response = await walletService.sendPayment({ prepareResponse: prepared });
```

with:

```ts
const prepared = await prepareSend(destination, amountSat);
const payment = await sendPayment(prepared);
```

adding `import { prepareSend, sendPayment } from "$lib/rails";`.

Fee display changes from `prepared.feesSat` to `prepared.feeSat`. Amount display changes from `prepared.amount?.receiverAmountSat` to `prepared.amountSat`.

For on-chain Bitcoin sends, `preparePayOnchain` / `payOnchain` are replaced by the same `prepareSend` / `sendPayment` pair — the router sends a Bitcoin address to Spark, which handles the withdrawal internally.

For LNURL and Lightning addresses, `prepareLnurlPay` / `lnurlPay` are likewise replaced by `prepareSend` / `sendPayment`; Spark's `prepareSendPayment` accepts a Lightning address or LNURL directly as `{ type: "input" }`.

- [ ] **Step 3: Update parse.ts**

`src/lib/parse.ts` calls `walletService.parseInput` and switches on the result to decide which route to redirect to. Leave that logic in place — it drives navigation, not rail selection. Change only the import so parsing uses the Spark parser when available:

```ts
import { adapters } from "$lib/rails";
import { getSparkSdk } from "$lib/rails/spark";
```

and replace `walletService.isConnected()` with `adapters.spark.isConnected() || adapters.liquid.isConnected()`, and `walletService.parseInput(t)` with:

```ts
const sdk = getSparkSdk();
const parsed = sdk ? await sdk.parse(t) : await walletService.parseInput(t);
```

Spark's `InputType` uses the same discriminant names for the cases this switch handles (`bitcoinAddress`, `bolt11Invoice`, `lnurlPay`, `bip21`), so the existing branches still match.

- [ ] **Step 4: Verify the build**

Run: `bun run build`
Expected: build succeeds with no references to removed `walletService` send functions.

Run: `grep -rn "walletService.sendPayment\|walletService.payOnchain\|walletService.lnurlPay" src/`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/routes/\(app\)/send src/components/SendLightning.svelte src/lib/parse.ts
git commit -m "feat(rails): route all sends through the rail router

Send screens no longer choose an SDK. Bitcoin on-chain sends, LNURL, and
Lightning addresses all go through prepareSend/sendPayment; the router
picks the rail from the destination."
```

---

## Task 13: Receive screen

**Files:**

- Modify: `src/routes/(app)/[username]/receive/+page.svelte`, `src/components/InvoiceTypes.svelte`, `src/lib/utils.ts:540-550`

**Interfaces:**

- Consumes: `createReceiveRequest` from `$lib/rails`
- Produces: receive flow routed by method; BOLT12 removed

- [ ] **Step 1: Remove the BOLT12 receive option**

Spec 6.2 removes BOLT12 _generation_, not the ability to pay one or to display payments already received over it.

**Keep the `bolt12` entry in the `types` object in `src/lib/utils.ts`.** It is still used by `src/routes/(app)/payment/[id]/+page.svelte:399` to render historical BOLT12 payments, and removing it breaks that screen.

Remove only the receive _option_:

- the BOLT12 tile in `src/components/InvoiceTypes.svelte` (its styling block and button)
- the `invoiceType === types.bolt12` branch in the receive page (around line 556)

Leave the send side alone — `SendLightning.svelte:177,278` and `parse.ts:80` handle `bolt12Offer` for paying, which Spark supports.

- [ ] **Step 2: Replace the three receive branches**

The receive page currently has three branches around lines 402, 447, and 488 calling `prepareReceivePayment` with `paymentMethod: "lightning"`, `"bitcoinAddress"`, and `"liquidAddress"`. Replace all three with one call:

```ts
const request = await createReceiveRequest(invoiceType, {
  amountSat: amount,
  description: memo,
  assetId: invoiceType === "usdt" ? ASSET_IDS.USDT : undefined,
});
invoiceText = request.destination;
```

adding `import { createReceiveRequest } from "$lib/rails";`.

The `invoiceType` values already match the router's expected keys (`lightning`, `bitcoin`, `liquid`, `usdt`), so no translation is needed.

- [ ] **Step 3: Remove the limits fetches**

Lines around 314 and 344 call `fetchOnchainLimits` and `fetchLightningLimits` in a `Promise.all`. These are Liquid swap limits and are meaningless for Spark. Remove both calls and any UI that displays them.

**These functions are called from six files, not just this one**, and they are now a crash risk rather than merely stale: `walletService.fetchLightningLimits` and `fetchOnchainLimits` both `throw new Error("SDK not initialized")` when the Liquid SDK is null — which the degradation model introduced in Task 10 explicitly permits. If Liquid fails to connect while Spark succeeds, any screen still calling them throws on a path the user expects to work.

Handle every call site:

| File                                                                         | Sites              | Action                                                                  |
| ---------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `src/routes/(app)/[username]/receive/+page.svelte`                           | 315, 316, 345, 346 | Remove (this task)                                                      |
| `src/components/SendLightning.svelte`                                        | 113, 147, 183      | Remove; Lightning is Spark now, and Spark surfaces fees at prepare time |
| `src/routes/(app)/send/bitcoin/[address]/[amount]/[...feeRate]/+page.svelte` | 102                | Remove; on-chain BTC is Spark now                                       |
| `src/components/BuyBitcoin.svelte`                                           | 92                 | Remove                                                                  |
| `src/lib/socket.ts`                                                          | 225, 226           | Remove                                                                  |
| `src/lib/stores/wallet.ts`                                                   | 793                | Remove the wrapper method                                               |

Removing the limits removes an amount-validation step. That is accepted: Spark reports fees and constraints from `prepareSendPayment` at the moment of sending, which is both later and more accurate than a standing limits call. Do not invent a replacement validation here.

If a minimum-amount hint is still wanted, Spark surfaces fees at prepare time rather than as standing limits; leave that out for now.

- [ ] **Step 4: Verify the build**

Run: `bun run build`
Expected: build succeeds.

Run: `grep -rn "fetchLightningLimits\|fetchOnchainLimits" src/`
Expected: hits only inside `walletService.ts` itself, which is fine — they are now unused exports.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/routes/\(app\)/\[username\]/receive src/components/InvoiceTypes.svelte
git commit -m "feat(rails): route receive through the rail router, drop BOLT12

Spark's receive methods are sparkAddress, sparkInvoice, bitcoinAddress
and bolt11Invoice — it can pay a BOLT12 invoice but cannot issue one, so
the receive option is removed. Swap limits go too; they were Liquid
swap constraints with no Spark equivalent."
```

---

## Task 14: Lightning address on Spark

Replaces roughly 400 lines of hand-rolled `breez.fun` HTTP with Spark's native calls.

**Files:**

- Modify: `src/lib/rails/spark.ts`, `src/routes/(app)/settings/lightning-address/+page.svelte`, `src/lib/stores/lightningAddress.ts`, `src/routes/(app)/+layout.svelte`

**Interfaces:**

- Consumes: `getSparkSdk` from `./spark`
- Produces: `registerLightningAddress(username, description?)`, `getLightningAddress()`, `checkLightningAddressAvailable(username)`, `deleteLightningAddress()` exported from `$lib/rails/spark`

- [ ] **Step 1: Add the Spark address functions**

Append to `src/lib/rails/spark.ts`:

```ts
export interface SparkLightningAddress {
  username: string;
  lightningAddress: string;
  description: string;
  lnurl: { url: string; bech32: string };
}

export async function checkLightningAddressAvailable(
  username: string,
): Promise<boolean> {
  const sdk = getSparkSdk();
  if (!sdk) throw new Error("Spark rail unavailable");
  return await sdk.checkLightningAddressAvailable({ username });
}

export async function registerLightningAddress(
  username: string,
  description?: string,
): Promise<SparkLightningAddress> {
  const sdk = getSparkSdk();
  if (!sdk) throw new Error("Spark rail unavailable");
  const info = await sdk.registerLightningAddress({ username, description });
  return info as unknown as SparkLightningAddress;
}

export async function getLightningAddress(): Promise<SparkLightningAddress | null> {
  const sdk = getSparkSdk();
  if (!sdk) return null;
  const info = await sdk.getLightningAddress();
  return (info as unknown as SparkLightningAddress) ?? null;
}

export async function deleteLightningAddress(): Promise<void> {
  const sdk = getSparkSdk();
  if (!sdk) throw new Error("Spark rail unavailable");
  await sdk.deleteLightningAddress();
}
```

Re-export them from `src/lib/rails/index.ts`:

```ts
export {
  getSparkNetworkStatus,
  registerLightningAddress,
  getLightningAddress,
  checkLightningAddressAvailable,
  deleteLightningAddress,
} from "./spark";
```

- [ ] **Step 2: Replace the settings page calls**

In `src/routes/(app)/settings/lightning-address/+page.svelte`, replace `walletService.registerLightningAddress`, `walletService.recoverLightningAddress`, `walletService.updateLightningAddress`, and `walletService.unregisterLightningAddress` with the new functions.

Recovery becomes a read: where the old code called `recoverLightningAddress(webhookUrl)`, call `getLightningAddress()`. Spark resolves ownership from the wallet's identity key, so there is no message to sign and no webhook to pass.

Availability checking becomes explicit. Before registering, call `checkLightningAddressAvailable(username)` and show the result. Do **not** port the old 20-attempt random-suffix retry loop: on a DGEN-owned domain the namespace is exclusive, so a collision means the user must pick a different name, and silently renaming them to `alice473` was the defect this migration fixes (spec 6.4).

- [ ] **Step 3: Update the layout's address bootstrap**

`src/routes/(app)/+layout.svelte` calls `walletService.recoverLightningAddress` around line 376 and `walletService.registerLightningAddress` around line 431. Replace with `getLightningAddress()` and `registerLightningAddress(baseUsername)` respectively, dropping the webhook URL argument.

- [ ] **Step 4: Verify the build**

Run: `bun run build`
Expected: build succeeds.

Run: `grep -rn "breez.fun" src/`
Expected: hits only inside `walletService.ts`, now dead. Task 16 removes them.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/lib/rails/spark.ts src/lib/rails/index.ts src/routes/\(app\)/settings/lightning-address "src/routes/(app)/+layout.svelte" src/lib/stores/lightningAddress.ts
git commit -m "feat(rails): use Spark's native Lightning address API

Replaces hand-rolled breez.fun HTTP — message signing, the 20-attempt
collision loop, the random-suffix fallback. On a DGEN-owned domain the
namespace is exclusive, so collisions are now reported to the user
instead of silently renaming them."
```

---

## Task 15: Deposit claims and network status

**Files:**

- Create: `src/components/DepositClaims.svelte`, `src/components/SparkStatusBanner.svelte`
- Modify: `src/lib/rails/spark.ts`, `src/routes/(app)/+layout.svelte`

**Interfaces:**

- Consumes: `getSparkSdk`, `getSparkNetworkStatus`; `unclaimedDepositCount` from `$lib/stores/rails`
- Produces: `listUnclaimedDeposits()`, `claimDeposit(txid, vout, maxFeeSat)` exported from `$lib/rails/spark`

- [ ] **Step 1: Add the deposit functions**

Append to `src/lib/rails/spark.ts`:

```ts
/**
 * A deposit the automatic ceiling would not cover.
 *
 * `requiredFeeSats` comes from the SDK's own claim error and is the exact
 * fee needed. Never invent a ceiling from the deposit amount — that would
 * permit a fee up to 100% of the deposit.
 */
export interface UnclaimedDeposit {
  txid: string;
  vout: number;
  amountSats: number;
  isMature: boolean;
  requiredFeeSats?: number;
}

export async function listUnclaimedDeposits(): Promise<UnclaimedDeposit[]> {
  const sdk = getSparkSdk();
  if (!sdk) return [];
  const response = await sdk.listUnclaimedDeposits({});
  return (response.deposits ?? []).map((d) => {
    const error = d.claimError as
      | { type: string; requiredFeeSats?: number }
      | undefined;
    return {
      txid: d.txid,
      vout: d.vout,
      amountSats: Number(d.amountSats ?? 0),
      isMature: Boolean(d.isMature),
      requiredFeeSats:
        error?.type === "maxDepositClaimFeeExceeded"
          ? Number(error.requiredFeeSats ?? 0)
          : undefined,
    };
  });
}

/**
 * Claim a deposit the automatic ceiling would not cover.
 *
 * `maxFeeSat` must be at least the SDK's quoted fee, or the call returns
 * MaxDepositClaimFeeExceeded and the deposit waits for maturity instead.
 * Pass the deposit's `requiredFeeSats` — nothing larger.
 *
 * Note: the docs describe `fetchClaimDepositQuote`, which does NOT exist in
 * pinned 0.23.0 (the docs track main). The claim error carries the fee
 * instead. Revisit on the next SDK bump.
 */
export async function claimDeposit(
  txid: string,
  vout: number,
  maxFeeSat: number,
): Promise<void> {
  const sdk = getSparkSdk();
  if (!sdk) throw new Error("Spark rail unavailable");
  await sdk.claimDeposit({
    txid,
    vout,
    maxFee: { type: "fixed", amount: maxFeeSat },
  });
}
```

- [ ] **Step 2: Create the claims component**

Create `src/components/DepositClaims.svelte`:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import {
    listUnclaimedDeposits,
    claimDeposit,
    type UnclaimedDeposit,
  } from "$lib/rails/spark";
  import { unclaimedDepositCount } from "$lib/stores/rails";

  let deposits = $state<UnclaimedDeposit[]>([]);
  let claiming = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function load() {
    try {
      deposits = await listUnclaimedDeposits();
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not load deposits";
    }
  }

  async function claim(deposit: UnclaimedDeposit) {
    const key = `${deposit.txid}:${deposit.vout}`;
    claiming = key;
    error = null;
    try {
      // Exactly the fee the SDK asked for. Never the deposit amount.
      await claimDeposit(
        deposit.txid,
        deposit.vout,
        deposit.requiredFeeSats ?? 0,
      );
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : "Claim failed";
    } finally {
      claiming = null;
    }
  }

  onMount(load);
  $effect(() => {
    if ($unclaimedDepositCount > 0) void load();
  });
</script>

{#if deposits.length > 0}
  <div class="rounded-2xl border border-warning/40 bg-warning/10 p-4">
    <h3 class="font-bold mb-2">Bitcoin waiting to be added</h3>
    <p class="text-sm opacity-70 mb-3">
      Network fees are higher than the automatic limit, so these need your
      approval before the money lands in your balance.
    </p>

    {#if error}
      <p class="text-sm text-error mb-2">{error}</p>
    {/if}

    <ul class="flex flex-col gap-2">
      {#each deposits as deposit (deposit.txid + deposit.vout)}
        <li class="flex items-center justify-between gap-3">
          <span class="flex flex-col">
            <span class="font-mono text-sm">{deposit.amountSats} sats</span>
            {#if deposit.requiredFeeSats}
              <span class="text-xs opacity-60"
                >Fee to add now: {deposit.requiredFeeSats} sats</span
              >
            {/if}
          </span>
          <button
            class="btn btn-sm btn-primary"
            disabled={claiming === `${deposit.txid}:${deposit.vout}` ||
              !deposit.isMature ||
              !deposit.requiredFeeSats}
            onclick={() => claim(deposit)}
          >
            {#if claiming === `${deposit.txid}:${deposit.vout}`}
              Adding…
            {:else if !deposit.isMature}
              Confirming
            {:else if !deposit.requiredFeeSats}
              Waiting
            {:else}
              Add for {deposit.requiredFeeSats} sats
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}
```

- [ ] **Step 3: Create the status banner**

Create `src/components/SparkStatusBanner.svelte`:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getSparkNetworkStatus } from "$lib/rails";

  let status = $state("operational");
  let timer: ReturnType<typeof setInterval> | null = null;

  const degraded = $derived(
    status === "degraded" || status === "partial" || status === "major",
  );

  const message = $derived(
    status === "major"
      ? "Bitcoin and Lightning payments are currently unavailable. Your money is safe."
      : "Bitcoin and Lightning payments may be slower than usual right now.",
  );

  async function check() {
    status = await getSparkNetworkStatus();
  }

  onMount(() => {
    void check();
    timer = setInterval(check, 5 * 60 * 1000);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });
</script>

{#if degraded}
  <div
    class="bg-warning/20 border-b border-warning/40 px-4 py-2 text-sm text-center"
    role="status"
  >
    {message}
  </div>
{/if}
```

- [ ] **Step 4: Mount both in the layout**

In `src/routes/(app)/+layout.svelte`, import both components and render `<SparkStatusBanner />` at the top of the app shell, above the main content. Render `<DepositClaims />` on the wallet home area alongside the balance.

- [ ] **Step 5: Verify the build**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
bun run format
git add src/components/DepositClaims.svelte src/components/SparkStatusBanner.svelte src/lib/rails/spark.ts "src/routes/(app)/+layout.svelte"
git commit -m "feat(rails): add deposit claims UI and network status banner

Deposits above the automatic fee ceiling need user approval rather than
silently waiting. The status banner is required by Breez's production
checklist and is the visibility that was missing during the Boltz outage."
```

---

## Task 16: Removals and cleanup

**Files:**

- Modify: `src/lib/assetService.ts`, `src/lib/walletService.ts`, `src/lib/sendGate.ts`, `src/lib/txErrors.ts`, `src/lib/stores/refundables.ts`, `src/components/RefundForm.svelte`, `src/routes/(app)/refunds/[swapAddress]/+page.svelte`, `src/lib/esplora/PollManager.ts`
- Delete: `tests/browser/wallet.spec.ts`

**Interfaces:**

- Consumes: everything from Tasks 1–15
- Produces: no dead payment code in the tree

- [ ] **Step 1: Remove the unreachable asset exchange**

`assetService.exchangeAssets` is called by no component — it was the one Liquid feature that depended on a swap service, and it is unreachable.

```bash
grep -rn "exchangeAssets" src/
```

Expected: only the definition in `src/lib/assetService.ts`. Delete the function.

- [ ] **Step 2: Rewrite refunds against the Spark deposit model**

`listRefundables`, `prepareRefund`, `refundSwap`, and `rescanOnchainSwaps` are Boltz swap recovery with no Spark equivalent (spec 6.1).

- Delete `src/lib/stores/refundables.ts`.
- Delete `src/components/RefundForm.svelte`.
- Delete the `src/routes/(app)/refunds/[swapAddress]/` route directory.
- Remove the four functions from `walletService.ts`.
- Run `grep -rn "refundables\|RefundForm\|listRefundables\|rescanOnchainSwaps" src/` and remove every remaining reference, including any navigation entries pointing at `/refunds`.

The client confirmed balances were withdrawn ahead of this work and no in-flight swaps remain, so there is nothing to recover.

- [ ] **Step 3: Remove the fee-acceptance status**

In `src/lib/stores/paymentEvents.ts`, remove `"fee_acceptance"` from the `PaymentStatus` union and its branch in `notifyPaymentReceived`. Spark claims deposits within a configured ceiling and surfaces the rest through `DepositClaims.svelte` (spec 6.3).

Run `grep -rn "fee_acceptance" src/` and remove every hit.

- [ ] **Step 4: Make the send gate per-rail**

`src/lib/sendGate.ts` gates outgoing transactions to avoid Liquid UTXO conflicts. Spark is not UTXO-based.

Change `trackOutgoingTx(txId, chain)` and `waitForOutgoingSlot()` so the wait applies only when `chain === "liquid"`:

```ts
export async function waitForOutgoingSlot(
  chain: "liquid" | "spark" = "liquid",
): Promise<void> {
  // Spark transfers are not UTXO-based, so there is no conflict to avoid.
  if (chain === "spark") return;
  // ... existing wait logic unchanged
}
```

`src/lib/rails/index.ts` already calls `waitForOutgoingSlot()` only on the Liquid branch, so no change is needed there.

- [ ] **Step 5: Stop polling Bitcoin in PollManager**

`src/lib/esplora/PollManager.ts` tracks both `"bitcoin"` and `"liquid"` chains. Spark now watches Bitcoin itself and emits deposit events (spec 4).

Remove Bitcoin tracking: in `trackPendingTx` and `trackConfirmingTx`, return early when `chain === "bitcoin"`. Leave all Liquid polling untouched.

- [ ] **Step 6: Add Spark error strings**

In `src/lib/txErrors.ts`, extend `mapTxError` with Spark's messages:

```ts
if (message.includes("MaxDepositClaimFeeExceeded")) {
  return "Network fees are too high to add this Bitcoin automatically. You can approve it manually.";
}
if (message.includes("DepositClaimInProgress")) {
  return "This deposit is already being added. It should appear shortly.";
}
if (message.includes("Spark rail unavailable")) {
  return "Bitcoin and Lightning payments are temporarily unavailable. Your money is safe.";
}
```

Place these before the existing generic fallback.

- [ ] **Step 7: Delete the stale browser test**

```bash
rm tests/browser/wallet.spec.ts
```

It has drifted out of sync with `walletService`, would fail today, and targets an architecture this plan replaces. Leaving it prevents the suite from ever passing in CI (spec 8).

- [ ] **Step 8: Verify everything**

```bash
bun run test
bun run build
bun run lint
```

Expected: all three succeed.

Run: `grep -rn "listRefundables\|exchangeAssets\|fee_acceptance\|bolt12" src/`
Expected: no output except send-side BOLT12 parsing, which is retained.

- [ ] **Step 9: Commit**

```bash
bun run format
git add -A
git commit -m "refactor: remove swap-era code paths

Removes Boltz swap refunds, the fee-acceptance prompt, unreachable asset
exchange, and Bitcoin polling now handled by Spark. Send gating becomes
Liquid-only. Deletes tests/browser/wallet.spec.ts, which had drifted from
the code it tested and blocked the suite from passing."
```

---

## Manual verification

Automated tests cover routing and mapping. These require real funds on mainnet and cannot be automated.

- [ ] Receive over Lightning from **Wallet of Satoshi**
- [ ] Receive over Lightning from **Breez**
- [ ] Receive over Lightning from **Muun**
- [ ] Receive over Lightning from **Bull Bitcoin**
- [ ] Receive over Lightning from **Phoenix**
- [ ] Send over Lightning to **Wallet of Satoshi**
- [ ] Send over Lightning to **Breez**
- [ ] Send over Lightning to **Muun**
- [ ] Send over Lightning to **Bull Bitcoin**
- [ ] Send over Lightning to **Phoenix**
- [ ] Receive on-chain Bitcoin; confirm automatic claim after 3 confirmations
- [ ] Receive on-chain Bitcoin at a high fee rate; confirm manual claim works
- [ ] Send on-chain Bitcoin
- [ ] Send and receive L-BTC (unchanged behaviour — confirm no regression)
- [ ] Send and receive L-USDT (unchanged behaviour — confirm no regression)
- [ ] Register a Lightning address on the new domain
- [ ] Reinstall from seed; confirm the Lightning address is recovered
- [ ] Open the wallet in two tabs; confirm the tab lock still holds
- [ ] Block the Spark endpoint; confirm Liquid still works and the UI shows Spark unavailable
- [ ] Block the Liquid endpoint; confirm Lightning still works and the UI shows Liquid unavailable

**On receiving:** Spark collects the sender's fee (~0.15%) through route hints on the invoice. Sending wallets enforce their own maximum-fee ceilings, so a wallet with a tight ceiling could reject an otherwise valid invoice. Only paying _into_ DGEN from each wallet exposes this, which is why both directions are listed.

## Deferred

- **Lightning address domain.** Registration needs `VITE_LNURL_DOMAIN` set and the domain allowlisted by Breez. Everything else in this plan works without it. Task 14 is testable once the domain is live.
- **Esplora chain service for Spark.** Breez confirmed a custom chain service can be supplied via `newRestChainService`, which would route Spark's Bitcoin traffic through the existing proxy. Not wired here — Spark's defaults work, and this is an optimisation. Worth doing before heavy load.
