import { describe, it, expect } from "vitest";
import { mergePayments } from "./index";
import type { RailPayment } from "./types";

function payment(over: Partial<RailPayment>): RailPayment {
  return {
    id: "x",
    rail: "spark",
    direction: "receive",
    status: "complete",
    amountSat: 1000,
    feeSat: 0,
    timestamp: 1756000000,
    method: "lightning",
    raw: {},
    ...over,
  };
}

describe("mergePayments", () => {
  it("sorts newest first across both rails", () => {
    const spark = [payment({ id: "s1", timestamp: 200 })];
    const liquid = [payment({ id: "l1", rail: "liquid", timestamp: 300 })];
    const merged = mergePayments(spark, liquid);
    expect(merged.map((p) => p.id)).toEqual(["l1", "s1"]);
  });

  it("keeps both rails' payments", () => {
    const merged = mergePayments(
      [payment({ id: "s1" })],
      [payment({ id: "l1", rail: "liquid" })],
    );
    expect(merged).toHaveLength(2);
  });

  it("deduplicates by rail and id, not id alone", () => {
    const merged = mergePayments(
      [payment({ id: "same" })],
      [payment({ id: "same", rail: "liquid" })],
    );
    expect(merged).toHaveLength(2);
  });

  it("removes true duplicates within one rail", () => {
    const merged = mergePayments(
      [payment({ id: "dup" }), payment({ id: "dup" })],
      [],
    );
    expect(merged).toHaveLength(1);
  });

  it("handles empty input", () => {
    expect(mergePayments([], [])).toEqual([]);
  });
});
