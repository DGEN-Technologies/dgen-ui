import { describe, it, expect } from "vitest";
import { mapTxError } from "./txErrors";

describe("mapTxError — Spark cases", () => {
  it("matches the SDK's camelCase spelling", () => {
    // The SDK type declares maxDepositClaimFeeExceeded in camelCase.
    expect(mapTxError("error: maxDepositClaimFeeExceeded")).toContain(
      "Network fees are too high",
    );
  });

  it("matches the docs' PascalCase spelling too", () => {
    expect(mapTxError("SdkError::MaxDepositClaimFeeExceeded")).toContain(
      "Network fees are too high",
    );
  });

  it("maps a claim already running", () => {
    expect(mapTxError("DepositClaimInProgress")).toContain(
      "already being added",
    );
  });

  it("maps an unavailable rail without implying funds are lost", () => {
    const msg = mapTxError("Spark rail unavailable");
    expect(msg).toContain("temporarily unavailable");
    expect(msg).toContain("Your money is safe");
  });

  it("passes unrecognised text through unchanged", () => {
    expect(mapTxError("something else entirely")).toBe(
      "something else entirely",
    );
  });

  it("falls back when there is no message", () => {
    expect(mapTxError("", "Payment failed")).toBe("Payment failed");
  });
});
