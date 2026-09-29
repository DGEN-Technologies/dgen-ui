import { describe, expect, it } from "vitest";
import {
  ASSET_IDS,
  parseAssetAmount,
  toAssetUnits,
  getAssetMetadata,
} from "./assets";

describe("toAssetUnits", () => {
  it("converts a smallest-unit USDT figure to asset units", () => {
    // The bug this guards: the receive screen held 0.1 USDT as 10_000_000 and
    // passed it straight to ReceiveAmount.payerAmount, which takes asset
    // units — asking the sender for ten million USDT.
    expect(toAssetUnits(10_000_000, ASSET_IDS.USDT)).toBe(0.1);
  });

  it("converts L-BTC sats to BTC", () => {
    expect(toAssetUnits(100_000_000, ASSET_IDS.LBTC)).toBe(1);
  });

  it("round-trips with parseAssetAmount", () => {
    for (const amount of [1, 0.1, 12.34, 1000]) {
      const smallest = parseAssetAmount(amount, ASSET_IDS.USDT);
      expect(toAssetUnits(smallest, ASSET_IDS.USDT)).toBeCloseTo(amount, 8);
    }
  });

  it("passes the figure through untouched for an unknown asset", () => {
    // No metadata means no precision to divide by. Guessing one would be
    // worse than leaving the number alone.
    expect(toAssetUnits(12_345, "not-a-real-asset-id")).toBe(12_345);
  });

  it("agrees with the precision recorded for each known asset", () => {
    for (const assetId of Object.values(ASSET_IDS)) {
      const precision = getAssetMetadata(assetId)?.precision;
      expect(precision).toBeDefined();
      expect(toAssetUnits(Math.pow(10, precision!), assetId)).toBe(1);
    }
  });
});
