import { describe, expect, it } from "bun:test";
import { isValidNetwork, isValidTxid, validateNetwork } from "./esplora";

describe("client esplora validation", () => {
  it("accepts valid txid format", () => {
    expect(
      isValidTxid(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).toBe(true);
  });

  it("rejects invalid txid format", () => {
    expect(isValidTxid("1234")).toBe(false);
  });

  it("recognizes valid networks", () => {
    expect(isValidNetwork("bitcoin")).toBe(true);
    expect(isValidNetwork("liquid")).toBe(true);
  });

  it("throws on invalid network", () => {
    expect(() => validateNetwork("invalid")).toThrow("Invalid network");
  });
});
