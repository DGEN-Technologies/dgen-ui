import type { RailPayment } from "./types";

/**
 * A payment carrying BOTH the normalized field names and the legacy ones the
 * existing UI reads.
 *
 * Why this exists rather than a rename: the plan called for renaming
 * `paymentTime` -> `timestamp`, `paymentType` -> `direction` and
 * `feesSat` -> `feeSat` at every consumer. In this codebase that is 57 call
 * sites across `transactionService.ts`, `PaymentsList.svelte` and
 * `stores/wallet.ts`, and the three files are not equivalent:
 *
 *   - `stores/wallet.ts` reads `event.details.paymentType` off RAW Liquid SDK
 *     events, not off a RailPayment. Renaming those would break SDK event
 *     handling outright.
 *   - `PaymentsList.svelte` reads the legacy names with no fallback in most
 *     places, so a missed site yields `undefined` rather than an error —
 *     every payment then renders as a send with a negative amount.
 *
 * Mapping once at the boundary keeps all existing behaviour, confines the
 * change to a single tested function, and leaves the rename as a separate
 * piece of work that can be done with the UI in front of you.
 */
export interface LegacyPayment extends RailPayment {
  /** Alias of `direction`. */
  paymentType: "send" | "receive";
  /** Alias of `timestamp`, unix seconds. */
  paymentTime: number;
  /** Alias of `feeSat`. */
  feesSat: number;
  /** Present only when the source payment carried one. */
  txId?: string;
  /** The source SDK payment, for rail-specific reads. */
  details?: unknown;
}

/**
 * Widen a normalized payment so both the new and existing readers work.
 *
 * Numeric fields always resolve to a number: the UI does arithmetic on
 * `amountSat` and `feesSat`, and `undefined` there produces NaN on screen
 * rather than an error.
 */
export function toLegacyPayment(payment: RailPayment): LegacyPayment {
  const raw = (payment.raw ?? {}) as Record<string, unknown>;
  const txId = typeof raw.txId === "string" ? raw.txId : undefined;

  return {
    ...payment,
    paymentType: payment.direction,
    paymentTime: payment.timestamp ?? 0,
    feesSat: payment.feeSat ?? 0,
    amountSat: payment.amountSat ?? 0,
    txId,
    // The SDK's own PaymentDetails, one level inside raw. Consumers read
    // details.type / .assetId / .assetInfo.amount / .description; handing them
    // the whole payment makes every one of those undefined, which silently
    // breaks USDT amount display and history search.
    details: raw.details,
  };
}
