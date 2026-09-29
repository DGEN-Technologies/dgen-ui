import { describe, it, expect } from "vitest";
import { toLegacyPayment } from "./legacy";
import type { RailPayment } from "./types";

const base: RailPayment = {
  id: "abc",
  rail: "spark",
  direction: "receive",
  status: "complete",
  amountSat: 21000,
  feeSat: 52,
  timestamp: 1756000000,
  method: "lightning",
  raw: { some: "sdk object" },
};

describe("toLegacyPayment", () => {
  it("exposes the field names existing UI reads", () => {
    const l = toLegacyPayment(base);
    expect(l.paymentType).toBe("receive");
    expect(l.paymentTime).toBe(1756000000);
    expect(l.feesSat).toBe(52);
    expect(l.amountSat).toBe(21000);
    expect(l.status).toBe("complete");
    expect(l.id).toBe("abc");
  });

  it("keeps the normalized names too, so both readers work", () => {
    const l = toLegacyPayment(base);
    expect(l.direction).toBe("receive");
    expect(l.timestamp).toBe(1756000000);
    expect(l.feeSat).toBe(52);
    expect(l.rail).toBe("spark");
  });

  it("maps send direction", () => {
    expect(toLegacyPayment({ ...base, direction: "send" }).paymentType).toBe(
      "send",
    );
  });

  it("surfaces the SDK's nested PaymentDetails, not the whole payment", () => {
    // Consumers read details.type / .assetId / .assetInfo.amount, which live
    // one level inside the raw payment. Handing them the whole payment makes
    // every one of those undefined and silently breaks USDT amounts.
    const withDetails = toLegacyPayment({
      ...base,
      raw: { amount: 1n, details: { type: "liquid", assetId: "abc" } },
    });
    expect(withDetails.details).toEqual({ type: "liquid", assetId: "abc" });
  });

  it("leaves details undefined when the raw payment carries none", () => {
    expect(toLegacyPayment({ ...base, raw: {} }).details).toBeUndefined();
  });

  it("carries a txId only when the raw payment had one", () => {
    expect(toLegacyPayment(base).txId).toBeUndefined();
    const withTx = toLegacyPayment({ ...base, raw: { txId: "f".repeat(64) } });
    expect(withTx.txId).toBe("f".repeat(64));
  });

  it("never emits undefined for a numeric field the UI does arithmetic on", () => {
    const l = toLegacyPayment({
      ...base,
      amountSat: 0,
      feeSat: 0,
      timestamp: 0,
    });
    expect(l.amountSat).toBe(0);
    expect(l.feesSat).toBe(0);
    expect(l.paymentTime).toBe(0);
  });
});
