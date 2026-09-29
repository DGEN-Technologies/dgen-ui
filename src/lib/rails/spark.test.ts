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
