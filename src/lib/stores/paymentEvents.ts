import { writable } from "svelte/store";
import type { Payment } from "@breeztech/breez-sdk-liquid";
import { notifyPaymentReceived as showBrowserNotification } from "$lib/notifications";

export type PaymentStatus =
  | "pending"
  | "confirmed"
  | "complete"
  | "fee_acceptance"
  | "failed"
  | "refundable";

export interface PaymentEvent {
  payment: any; // Payment details from SDK event
  status: PaymentStatus;
  timestamp: number;
}

// Store for broadcasting payment received events across components
export const paymentReceived = writable<PaymentEvent | null>(null);

/**
 * How settled each status is. Used ONLY to stop a later, less-settled
 * notification from contradicting one the user has already been shown.
 *
 * -1 means "never suppress": these need the user to look at them, so they
 * always get through regardless of what was shown before.
 */
const SETTLEMENT_RANK: Record<PaymentStatus, number> = {
  pending: 0,
  confirmed: 1,
  complete: 2,
  fee_acceptance: -1,
  failed: -1,
  refundable: -1,
};

/**
 * How long the guard keeps suppressing a lower-ranked notification.
 *
 * The two sources share no id — the socket carries the server's payment
 * object, the SDK carries Spark's — so this can only key on amount, and a
 * wide window therefore swallows a genuinely NEW payment of the same amount.
 * Two same-amount receives inside a few seconds is rare; the contradiction it
 * exists to stop always lands within one or two, because both announcements
 * describe the same event. Ten seconds covers that and little else.
 *
 * It was two minutes, which made identical round amounts — tips, splits,
 * repeated test sends — disappear with no toast and no receipt.
 */
const CONTRADICTION_WINDOW_MS = 10 * 1000;

let lastSettled: { amountSat: number; rank: number; at: number } | null = null;

/** Exported for tests. */
export function resetSettlementGuard(): void {
  lastSettled = null;
}

// Function to notify all listeners that a payment was received
// Status guide (from Breez SDK docs):
// - 'pending': Show payment as pending (lockup tx broadcast)
// - 'confirmed': Display successful payment feedback (claim tx broadcast/seen)
// - 'complete': Show payment as complete (transaction confirmed)
// - 'fee_acceptance': Allow user to review fees (Bitcoin amountless swap)
// - 'failed': Payment failed
// - 'refundable': Payment failed but needs refund (Bitcoin only)
export function notifyPaymentReceived(
  payment: any,
  status: PaymentStatus = "pending",
) {
  if (import.meta.env.DEV) {
    const paymentId =
      payment?.txId || payment?.paymentHash || payment?.details?.paymentHash;
    const idSuffix =
      typeof paymentId === "string" ? paymentId.slice(-4) : undefined;
    console.log("[PaymentEvents] Payment received:", { status, idSuffix });
  }

  // Two independent sources announce the same payment: the DGEN server's
  // socket, which reports "confirmed" once the LNURL webhook settles, and the
  // Spark SDK's own event stream, which reports "pending" first. They arrive
  // in either order and share no id — the socket carries the server's payment
  // object, the SDK carries Spark's — so the amount plus recency is the only
  // identity common to both.
  //
  // Without this, a 5 sat receive showed "Payment received!" on the receipt
  // screen and a "Payment Pending: 5 sats" toast beneath it at the same
  // moment. A wallet contradicting itself about whether money arrived is
  // worse than either message alone.
  const rank = SETTLEMENT_RANK[status] ?? -1;
  const amountSat = Number(payment?.amountSat ?? 0);
  const isDowngrade =
    rank >= 0 &&
    amountSat > 0 &&
    lastSettled !== null &&
    amountSat === lastSettled.amountSat &&
    rank < lastSettled.rank &&
    Date.now() - lastSettled.at < CONTRADICTION_WINDOW_MS;

  if (isDowngrade) return;

  if (rank >= 0 && amountSat > 0) {
    lastSettled = { amountSat, rank, at: Date.now() };
  }

  const event: PaymentEvent = {
    payment,
    status,
    timestamp: Date.now(),
  };

  paymentReceived.set(event);

  // Show browser notification for incoming payments
  if (payment?.amountSat) {
    showBrowserNotification(payment.amountSat, status);
  }

  // Clear after 5 seconds for 'confirmed' status (to allow UI transitions)
  // Don't auto-clear for 'pending' or 'fee_acceptance' (they need user interaction)
  if (status === "confirmed" || status === "complete") {
    setTimeout(() => {
      paymentReceived.set(null);
    }, 5000);
  }
}
