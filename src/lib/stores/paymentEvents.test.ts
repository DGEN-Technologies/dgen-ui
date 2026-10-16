import { beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

vi.mock("$lib/notifications", () => ({
  notifyPaymentReceived: vi.fn(),
}));

const { notifyPaymentReceived, paymentReceived, resetSettlementGuard } =
  await import("./paymentEvents");

describe("notifyPaymentReceived settlement guard", () => {
  beforeEach(() => {
    resetSettlementGuard();
    paymentReceived.set(null);
  });

  it("does not let a pending event contradict a confirmed one", () => {
    // The real sequence: the server socket confirms, then Spark's own event
    // stream reports the same payment as pending. The user saw both at once.
    notifyPaymentReceived({ amountSat: 5 }, "confirmed");
    notifyPaymentReceived({ amountSat: 5 }, "pending");
    expect(get(paymentReceived)?.status).toBe("confirmed");
  });

  it("still upgrades pending -> confirmed -> complete", () => {
    notifyPaymentReceived({ amountSat: 5 }, "pending");
    expect(get(paymentReceived)?.status).toBe("pending");
    notifyPaymentReceived({ amountSat: 5 }, "confirmed");
    expect(get(paymentReceived)?.status).toBe("confirmed");
    notifyPaymentReceived({ amountSat: 5 }, "complete");
    expect(get(paymentReceived)?.status).toBe("complete");
  });

  it("never suppresses a status the user has to act on", () => {
    notifyPaymentReceived({ amountSat: 5 }, "complete");
    for (const status of ["failed", "refundable", "fee_acceptance"] as const) {
      notifyPaymentReceived({ amountSat: 5 }, status);
      expect(get(paymentReceived)?.status).toBe(status);
    }
  });

  it("does not suppress a different amount", () => {
    notifyPaymentReceived({ amountSat: 5 }, "confirmed");
    notifyPaymentReceived({ amountSat: 11 }, "pending");
    expect(get(paymentReceived)?.status).toBe("pending");
    expect(get(paymentReceived)?.payment.amountSat).toBe(11);
  });

  it("does not suppress a second same-amount payment once the window passes", () => {
    // The guard can only key on amount, so a wide window swallowed genuine
    // repeat payments — identical round amounts are the common case.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      notifyPaymentReceived({ amountSat: 1000 }, "complete");
      vi.setSystemTime(new Date("2026-01-01T00:00:11Z")); // > 10s window
      notifyPaymentReceived({ amountSat: 1000 }, "pending");
      expect(get(paymentReceived)?.status).toBe("pending");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not suppress when the amount is unknown", () => {
    // No amount means no identity to match on, so the guard must stay out of
    // the way rather than silently dropping a notification.
    notifyPaymentReceived({ amountSat: 5 }, "confirmed");
    notifyPaymentReceived({}, "pending");
    expect(get(paymentReceived)?.status).toBe("pending");
  });
});
