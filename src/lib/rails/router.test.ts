import { describe, it, expect } from "vitest";
import { railForDestination, railForReceiveMethod } from "./router";

describe("railForDestination", () => {
  it("routes bolt11 invoices to spark", () => {
    expect(railForDestination("lnbc1500n1p3xyz")).toBe("spark");
  });

  it("routes uppercase bolt11 invoices to spark", () => {
    expect(railForDestination("LNBC1500N1P3XYZ")).toBe("spark");
  });

  it("routes lightning: URIs to spark", () => {
    expect(railForDestination("lightning:lnbc1500n1p3xyz")).toBe("spark");
  });

  it("routes lightning addresses to spark", () => {
    expect(railForDestination("alice@dgen.app")).toBe("spark");
  });

  it("routes lnurl strings to spark", () => {
    expect(railForDestination("LNURL1DP68GURN8GHJ7")).toBe("spark");
  });

  it("routes bitcoin: URIs to spark", () => {
    expect(railForDestination("bitcoin:bc1qxyz?amount=0.001")).toBe("spark");
  });

  it("routes bech32 bitcoin addresses to spark", () => {
    expect(railForDestination("bc1qar0srrr7xfkvy5l643lydnw9re59gtzz")).toBe(
      "spark",
    );
  });

  it("routes legacy bitcoin addresses to spark", () => {
    expect(railForDestination("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(
      "spark",
    );
  });

  it("routes liquidnetwork: URIs to liquid", () => {
    expect(railForDestination("liquidnetwork:lq1qqxyz")).toBe("liquid");
  });

  it("routes confidential liquid addresses to liquid", () => {
    expect(railForDestination("lq1qqw508d6qejxtdg4y5r3zarvary0c5xw7k")).toBe(
      "liquid",
    );
  });

  it("routes VJL-prefixed liquid addresses to liquid", () => {
    expect(railForDestination("VJLbFVfsAJDUJfJmqQfZ5s1nnMxvDzKqRq")).toBe(
      "liquid",
    );
  });

  it("routes a lightning address whose name starts with a liquid prefix to spark", () => {
    // "vt" is a two-character Liquid prefix; usernames collide with it easily.
    expect(railForDestination("vtuber@getalby.com")).toBe("spark");
  });

  it("routes lq1-prefixed lightning addresses to spark", () => {
    expect(railForDestination("lq1user@getalby.com")).toBe("spark");
  });

  it("routes ex1-prefixed lightning addresses to spark", () => {
    expect(railForDestination("ex1ample@getalby.com")).toBe("spark");
  });

  it("trims surrounding whitespace before deciding", () => {
    expect(railForDestination("  lnbc1500n1p3xyz  ")).toBe("spark");
  });

  it("falls back to spark for unrecognised input", () => {
    expect(railForDestination("something-unrecognised")).toBe("spark");
  });

  it("falls back to spark for empty input", () => {
    expect(railForDestination("")).toBe("spark");
  });
});

describe("railForReceiveMethod", () => {
  it("routes lightning to spark", () => {
    expect(railForReceiveMethod("lightning")).toBe("spark");
  });

  it("routes bitcoin to spark", () => {
    expect(railForReceiveMethod("bitcoin")).toBe("spark");
  });

  it("routes liquid to liquid", () => {
    expect(railForReceiveMethod("liquid")).toBe("liquid");
  });

  it("routes usdt to liquid", () => {
    expect(railForReceiveMethod("usdt")).toBe("liquid");
  });

  it("falls back to spark for unknown methods", () => {
    expect(railForReceiveMethod("nonsense")).toBe("spark");
  });
});

describe("base58 Liquid addresses", () => {
  // These fell through to the "unrecognised, default rail" branch and were
  // handed to Spark, which cannot parse a Liquid address.
  it.each([
    ["Q", "QLFrGsTUqvbmiGHqBEqLYqDLpQfXvzgAhH"],
    ["G", "GqBEqLYqDLpQfXvzgAhHQLFrGsTUqvbmiH"],
    ["H", "HqBEqLYqDLpQfXvzgAhHQLFrGsTUqvbmiG"],
  ])("routes a %s-prefixed address to liquid", (_label, address) => {
    expect(railForDestination(address)).toBe("liquid");
  });

  it("does not capture a bitcoin base58 address", () => {
    expect(railForDestination("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(
      "spark",
    );
  });

  it("does not capture a lightning address starting with the same letter", () => {
    expect(railForDestination("gregory@breez.tips")).toBe("spark");
  });
});
