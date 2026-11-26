import { expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import {
  balanceSats,
  createInvoice,
  gotoApp,
  importSeed,
  login,
  prepContext,
  test,
} from "./helpers";

// Real tiny payments between two test wallets that Cole funds.
// Needs these GitHub secrets (skipped if missing):
//   E2E_WALLET_A_USER, E2E_WALLET_A_PASS, E2E_WALLET_A_SEED
//   E2E_WALLET_B_USER, E2E_WALLET_B_PASS, E2E_WALLET_B_SEED
// Each run sends E2E_PAY_USD (default $0.01) A -> B, then B -> A.
// If either wallet is below E2E_MIN_SATS (default 300), writes low-balance.json
// so the workflow opens a "Top up test wallet" issue, and skips paying.

const env = process.env;
const A = {
  username: env.E2E_WALLET_A_USER!,
  password: env.E2E_WALLET_A_PASS!,
  seed: env.E2E_WALLET_A_SEED!,
};
const B = {
  username: env.E2E_WALLET_B_USER!,
  password: env.E2E_WALLET_B_PASS!,
  seed: env.E2E_WALLET_B_SEED!,
};
const USD = env.E2E_PAY_USD || "0.01";
const MIN = parseInt(env.E2E_MIN_SATS || "300", 10);

test.skip(
  !(A.seed && B.seed && A.password && B.password),
  "payment wallet secrets not set",
);
test.describe.configure({ mode: "serial" });

let pa: Page;
let pb: Page;

const pay = async (from: Page, to: Page, toUser: string) => {
  const invoice = await createInvoice(to, toUser, USD);
  await gotoApp(from, "/send");
  await from.fill("textarea[name=text]", invoice);
  await from.getByRole("button", { name: "Next" }).click();
  await from.getByRole("button", { name: "Send Payment" }).click();
  await from.waitForURL(/\/sent\/|\/payment\//, { timeout: 120_000 });
};

test.beforeAll(async ({ browser }) => {
  pa = await (await prepContext(await browser.newContext())).newPage();
  pb = await (await prepContext(await browser.newContext())).newPage();
  await login(pa, A);
  await importSeed(pa, A.seed);
  await login(pb, B);
  await importSeed(pb, B.seed);
});

test("test wallets have enough balance", async () => {
  const [ba, bb] = [
    await balanceSats(pa, A.username),
    await balanceSats(pb, B.username),
  ];
  console.log(`balances: A=${ba} sats, B=${bb} sats`);
  if (!(ba >= MIN && bb >= MIN)) {
    writeFileSync(
      "low-balance.json",
      JSON.stringify({ A: ba, B: bb, min: MIN, a: A.username, b: B.username }),
    );
  }
  expect(ba, "wallet A balance").toBeGreaterThanOrEqual(MIN);
  expect(bb, "wallet B balance").toBeGreaterThanOrEqual(MIN);
});

test("A pays B, then B pays A back", async () => {
  const before = await balanceSats(pb, B.username);
  await pay(pa, pb, B.username);
  await expect
    .poll(() => balanceSats(pb, B.username), {
      timeout: 180_000,
      intervals: [15_000],
    })
    .toBeGreaterThan(before);
  const beforeA = await balanceSats(pa, A.username);
  await pay(pb, pa, A.username);
  await expect
    .poll(() => balanceSats(pa, A.username), {
      timeout: 180_000,
      intervals: [15_000],
    })
    .toBeGreaterThan(beforeA);
});
