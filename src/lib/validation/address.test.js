import { describe, expect, it } from "bun:test";
import { isValidAddress } from "./address";

describe("client address validation", () => {
  it("accepts base58 format", () => {
    expect(isValidAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(true);
  });

  it("accepts bech32 format", () => {
    expect(isValidAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")).toBe(
      true,
    );
  });

  it("rejects non-alphanumeric input", () => {
    expect(isValidAddress("bc1q$badaddress")).toBe(false);
  });

  it("rejects too-short input", () => {
    expect(isValidAddress("bc1q")).toBe(false);
  });
});
