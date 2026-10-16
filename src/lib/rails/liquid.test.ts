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
