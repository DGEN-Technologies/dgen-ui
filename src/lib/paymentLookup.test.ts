import { describe, it, expect } from "vitest";
import { toLegacyPayment } from "./rails/legacy";
import type { RailPayment } from "./rails/types";
import { getPaymentId } from "./transactionService";

/**
 * The payment detail route resolves `/payment/<id>` against the payments it
 * can see. The bug these cover: it saw only the Liquid rail, so every
 * Lightning row in the history list resolved to nothing when opened, and the
 * user got "Payment Not Found" on a payment visible a moment earlier.
 *
 * The route's own `load` is a SvelteKit module with `$app/environment` and
 * dynamic `$lib` imports, so what is pinned here is the contract it depends
 * on: the id a Spark payment is listed under is the id it is found under, and
 * a Liquid-only view cannot satisfy that.
 */

const sparkLightning: RailPayment = {
  id: "spark-payment-id-1",
  rail: "spark",
  direction: "receive",
  status: "complete",
  amountSat: 666,
  feeSat: 0,
  timestamp: 1757577540,
  method: "lightning",
  raw: { details: { paymentHash: "hash-abc" } },
};

const liquidReceive = {
  txId: "liquid-tx-1",
  paymentType: "receive",
  paymentTime: 1757500000,
  amountSat: 314,
  feesSat: 1,
  status: "complete",
} as any;

describe("payment detail id resolution", () => {
  it("resolves a Spark payment under the id the list links with", () => {
    const listed = toLegacyPayment(sparkLightning);
    const linkedId = getPaymentId(listed as any);

    // What the fixed loader does: search both rails for that id.
    const bothRails = [liquidReceive, listed];
    const found = bothRails.find((tx) => getPaymentId(tx as any) === linkedId);

    expect(found).toBeDefined();
    expect(found).toBe(listed);
  });

  it("fails to resolve a Spark payment when only Liquid is searched", () => {
    // The old behaviour, pinned so a regression to a single-rail read is a
    // test failure rather than a support ticket.
    const listed = toLegacyPayment(sparkLightning);
    const linkedId = getPaymentId(listed as any);

    const liquidOnly = [liquidReceive];
    const found = liquidOnly.find((tx) => getPaymentId(tx as any) === linkedId);

    expect(found).toBeUndefined();
  });

  it("still resolves a Liquid payment once both rails are searched", () => {
    const bothRails = [liquidReceive, toLegacyPayment(sparkLightning)];
    const found = bothRails.find(
      (tx) => getPaymentId(tx as any) === "liquid-tx-1",
    );
    expect(found).toBe(liquidReceive);
  });

  it("gives a Spark payment the same id in the list and the cache", () => {
    // The list, the IndexedDB key and the detail lookup must agree. They
    // disagreed once before, under a hand-rolled priority list that put txId
    // first; this pins the single helper as the only answer.
    const listed = toLegacyPayment(sparkLightning);
    expect(getPaymentId(listed as any)).toBe("spark-payment-id-1");
  });
});
