#!/usr/bin/env node
/**
 * Spark rail smoke test — no browser, no login, no funds.
 *
 * Answers one question: is the Spark rail actually alive for this API key?
 * It connects a throwaway wallet, mints a real Lightning invoice and a real
 * on-chain deposit address, and checks Lightning-address registration. None
 * of that moves money, so it is safe to run repeatedly.
 *
 *   node scripts/spark-smoke.mjs                 # throwaway seed, read-only
 *   node scripts/spark-smoke.mjs --register NAME # also claims NAME@breez.tips
 *
 * Set SPARK_SMOKE_MNEMONIC to reuse a specific wallet instead of a throwaway
 * one. The mnemonic is never printed, and the seed used here is unrelated to
 * any wallet the app creates for a user.
 */
import { readFileSync } from "node:fs";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import pkg from "@breeztech/breez-sdk-spark/nodejs";

// The browser reads these through Vite; Node does not, so parse .env directly.
function envFromDotenv(key) {
  try {
    const line = readFileSync(new URL("../.env", import.meta.url), "utf-8")
      .split("\n")
      .find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const apiKey =
  process.env.VITE_SPARK_API_KEY ||
  process.env.VITE_BREEZ_API_KEY ||
  envFromDotenv("VITE_SPARK_API_KEY") ||
  envFromDotenv("VITE_BREEZ_API_KEY");

if (!apiKey) {
  console.error("No Spark API key found in env or .env — cannot test.");
  process.exit(2);
}

const registerIdx = process.argv.indexOf("--register");
const registerName = registerIdx > -1 ? process.argv[registerIdx + 1] : null;

const pass = (label, detail = "") =>
  console.log(`  ok    ${label}${detail ? "  " + detail : ""}`);
const fail = (label, e) => {
  console.log(`  FAIL  ${label}  ${e?.message ?? String(e)}`);
  failures.push(label);
};
const failures = [];

const cfg = pkg.defaultConfig("mainnet");
cfg.apiKey = apiKey;
// Mirrors src/lib/rails/spark.ts so this exercises the app's real config.
cfg.maxDepositClaimFee = { type: "networkRecommended", leewaySatPerVbyte: 2 };
const domain =
  process.env.VITE_LNURL_DOMAIN || envFromDotenv("VITE_LNURL_DOMAIN");
if (domain) cfg.lnurlDomain = domain;

console.log(`\nSpark smoke test — lnurlDomain: ${cfg.lnurlDomain}\n`);

// 1. Network status — needs no wallet at all.
try {
  const st = await pkg.getSparkStatus();
  pass("network status", JSON.stringify(st.status ?? st));
} catch (e) {
  fail("network status", e);
}

const mnemonic =
  process.env.SPARK_SMOKE_MNEMONIC || generateMnemonic(wordlist, 128);

let sdk;
try {
  sdk = await pkg.connect({
    config: cfg,
    seed: { type: "mnemonic", mnemonic },
    storageDir: "./.spark-smoke-data",
  });
  pass("connect");
} catch (e) {
  fail("connect", e);
  console.log("\nCannot continue without a connection.\n");
  process.exit(1);
}

try {
  const info = await sdk.getInfo({});
  pass("getInfo", `balance ${info.balanceSats} sats`);
} catch (e) {
  fail("getInfo", e);
}

// 2. Mint a real BOLT11. Proves Spark's Lightning side end to end: an
//    invoice that decodes is one their node actually issued.
try {
  const r = await sdk.receivePayment({
    paymentMethod: {
      type: "bolt11Invoice",
      description: "spark smoke test",
      amountSats: 1000,
    },
  });
  const inv = r.paymentRequest;
  const looksReal = /^lnbc/i.test(inv);
  if (!looksReal) throw new Error(`not a mainnet bolt11: ${inv.slice(0, 24)}`);
  pass("mint bolt11 invoice", `${inv.slice(0, 34)}…  (fee ${r.fee ?? 0})`);
  console.log(
    `\n        paste this into any wallet to verify it decodes:\n        ${inv}\n`,
  );
} catch (e) {
  fail("mint bolt11 invoice", e);
}

// 3. On-chain deposit address.
try {
  const r = await sdk.receivePayment({
    paymentMethod: { type: "bitcoinAddress" },
  });
  pass("on-chain deposit address", r.paymentRequest);
} catch (e) {
  fail("on-chain deposit address", e);
}

// 4. Lightning address. Availability is a read; registration is a write and
//    only runs when explicitly asked for.
try {
  const existing = await sdk.getLightningAddress();
  pass(
    "existing lightning address",
    existing ? existing.lightningAddress : "(none for this seed)",
  );
} catch (e) {
  fail("existing lightning address", e);
}

const probeName = registerName ?? `smoke${Date.now().toString().slice(-8)}`;
try {
  const free = await sdk.checkLightningAddressAvailable({
    username: probeName,
  });
  pass(
    "check address availability",
    `${probeName} -> ${free ? "free" : "taken"}`,
  );
} catch (e) {
  fail("check address availability", e);
}

if (registerName) {
  try {
    const info = await sdk.registerLightningAddress({
      username: registerName,
      description: "spark smoke test",
    });
    pass("register lightning address", info.lightningAddress);
    console.log(
      `\n        pay it from another wallet to test receive:\n        ${info.lightningAddress}\n`,
    );
  } catch (e) {
    fail("register lightning address", e);
  }
} else {
  console.log("  skip  register lightning address  (pass --register NAME)");
}

try {
  await sdk.disconnect();
} catch {
  /* nothing useful to do on a teardown failure */
}

console.log(
  failures.length
    ? `\n${failures.length} failed: ${failures.join(", ")}\n`
    : "\nAll checks passed — the Spark rail is reachable and functional.\n",
);
process.exit(failures.length ? 1 : 0);
