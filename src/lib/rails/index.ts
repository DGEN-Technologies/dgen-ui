import {
  sparkAdapter,
  getSparkSdk,
  toRailPayment as toSparkPayment,
} from "./spark";
import { liquidAdapter, toRailPayment as toLiquidPayment } from "./liquid";
import { railForDestination, railForReceiveMethod } from "./router";
import * as walletService from "$lib/walletService";
import { sdkLogger } from "$lib/logger";
import { waitForOutgoingSlot, trackOutgoingTx } from "$lib/sendGate";
import { toAssetUnits } from "$lib/assets";
import type { Rail, RailAdapter, RailEvent, RailPayment } from "./types";

export * from "./types";
export { railForDestination, railForReceiveMethod } from "./router";
export type { SparkLightningAddress } from "./spark";
export { LNURL_DOMAIN } from "./spark";
export {
  getSparkNetworkStatus,
  registerLightningAddress,
  getLightningAddress,
  checkLightningAddressAvailable,
  deleteLightningAddress,
} from "./spark";

export const adapters: Record<Rail, RailAdapter> = {
  spark: sparkAdapter,
  liquid: liquidAdapter,
};

export function adapterFor(rail: Rail): RailAdapter {
  return adapters[rail];
}

/**
 * Connect both rails in parallel, degrading independently.
 *
 * The wallet must never be dead because the less-used rail failed, so a
 * rejection on one side is logged and swallowed rather than propagated.
 * Callers read each rail's state via `isConnected()`.
 */
export async function connectRails(
  mnemonic: string,
  userId?: string,
): Promise<void> {
  const results = await Promise.allSettled([
    sparkAdapter.connect(mnemonic, userId),
    liquidAdapter.connect(mnemonic, userId),
  ]);

  results.forEach((result, i) => {
    const rail = i === 0 ? "spark" : "liquid";
    if (result.status === "rejected") {
      sdkLogger.error(`[rails] ${rail} failed to connect:`, result.reason);
    }
  });

  if (results.every((r) => r.status === "rejected")) {
    throw new Error("Both payment rails failed to connect");
  }
}

export async function disconnectRails(): Promise<void> {
  await Promise.allSettled([
    sparkAdapter.disconnect(),
    liquidAdapter.disconnect(),
  ]);
}

/**
 * How fast an on-chain Bitcoin send should confirm. Mirrors Spark's
 * OnchainConfirmationSpeed; the send screen offers all three.
 */
export type OnchainSpeed = "slow" | "medium" | "fast";

/**
 * Total sats for one tier of a Spark on-chain fee quote.
 *
 * A tier carries two separate figures and the user pays both. Reading only
 * `userFeeSat` understates the cost by the L1 broadcast fee.
 */
function speedFeeSat(quote: unknown): number {
  const q = quote as
    | { userFeeSat?: number; l1BroadcastFeeSat?: number }
    | undefined;
  return Number(q?.userFeeSat ?? 0) + Number(q?.l1BroadcastFeeSat ?? 0);
}

/**
 * The three confirmation-speed prices for an on-chain send, or undefined for
 * every other payment method. Doubles as the gate in `sendPayment` for
 * whether a confirmation speed may be sent at all.
 */
function onchainFeesFrom(
  paymentMethod: unknown,
): Record<OnchainSpeed, number> | undefined {
  const m = paymentMethod as any;
  if (m?.type !== "bitcoinAddress" || !m.feeQuote) return undefined;
  return {
    slow: speedFeeSat(m.feeQuote.speedSlow),
    medium: speedFeeSat(m.feeQuote.speedMedium),
    fast: speedFeeSat(m.feeQuote.speedFast),
  };
}

/**
 * The fee for a prepared Spark payment, in sats.
 *
 * Each SendPaymentMethod variant carries its fee in a different field, and an
 * on-chain send does not carry a flat one at all — it carries a feeQuote with
 * a figure per confirmation speed. Reading one field across all variants
 * silently reported 0 for on-chain Bitcoin sends, so the user saw "no fee"
 * and was then charged real miner fees.
 *
 * The medium quote is the headline figure because sendPayment defaults to
 * medium when no OnchainConfirmationSpeed is supplied.
 */
function sparkFeeSat(paymentMethod: unknown): number {
  const m = paymentMethod as any;
  switch (m?.type) {
    case "bolt11Invoice":
      return (
        Number(m.lightningFeeSats ?? 0) + Number(m.sparkTransferFeeSats ?? 0)
      );
    case "bitcoinAddress":
      return speedFeeSat(m.feeQuote?.speedMedium);
    case "sparkAddress":
    case "sparkInvoice":
      return Number(m.fee ?? 0);
    case "crossChainAddress":
      return Number(m.feeAmount ?? 0);
    default:
      sdkLogger.warn(`[rails] unknown Spark payment method: ${m?.type}`);
      return 0;
  }
}

export interface PreparedSend {
  rail: Rail;
  amountSat: number;
  feeSat: number;
  destination: string;
  /**
   * Spark on-chain Bitcoin sends only: what each confirmation speed costs, in
   * sats. Absent for every other payment method, which is what makes it a safe
   * gate for passing a speed back to `sendPayment`.
   */
  onchainFees?: Record<OnchainSpeed, number>;
  /** Rail-specific prepare response, passed straight back to sendPayment. */
  raw: unknown;
}

/**
 * Prepare a payment. The rail is chosen from the destination; callers
 * never pick.
 */
export async function prepareSend(
  destination: string,
  amountSat?: number,
): Promise<PreparedSend> {
  const rail = railForDestination(destination);

  if (rail === "spark") {
    const sdk = getSparkSdk();
    if (!sdk) throw new Error("Spark rail unavailable");
    const prepared = await sdk.prepareSendPayment({
      paymentRequest: { type: "input", input: destination.trim() },
      amount: amountSat !== undefined ? BigInt(amountSat) : undefined,
    });
    const feeSat = sparkFeeSat(prepared.paymentMethod);
    return {
      rail,
      amountSat: Number(prepared.amount ?? 0),
      feeSat,
      destination,
      onchainFees: onchainFeesFrom(prepared.paymentMethod),
      raw: prepared,
    };
  }

  const prepared = await walletService.prepareSendPayment({
    destination: destination.trim(),
    amount:
      amountSat !== undefined
        ? { type: "bitcoin", receiverAmountSat: amountSat }
        : undefined,
  } as any);

  return {
    rail,
    amountSat: Number(
      (prepared as any)?.amount?.receiverAmountSat ?? amountSat ?? 0,
    ),
    feeSat: Number((prepared as any)?.feesSat ?? 0),
    destination,
    raw: prepared,
  };
}

/**
 * Execute a prepared payment.
 *
 * The send gate is per-rail. Liquid keeps the existing UTXO-conflict gate;
 * Spark is not UTXO-based, so gating it there would slow Lightning for no
 * benefit.
 *
 * `speed` applies only to an on-chain Bitcoin send. Omitting it leaves Spark
 * on its medium default, which is the figure `feeSat` reported.
 */
export async function sendPayment(
  prepared: PreparedSend,
  speed?: OnchainSpeed,
): Promise<RailPayment> {
  if (prepared.rail === "spark") {
    const sdk = getSparkSdk();
    if (!sdk) throw new Error("Spark rail unavailable");
    // SendPaymentOptions is a tagged union, so handing the bitcoinAddress
    // variant to a Lightning send is rejected outright. `onchainFees` is set
    // only by an on-chain prepare, which makes it the correct gate — checking
    // `speed` alone would let a caller break every other payment method.
    const options =
      speed && prepared.onchainFees
        ? ({ type: "bitcoinAddress", confirmationSpeed: speed } as const)
        : undefined;
    const response = await sdk.sendPayment({
      prepareResponse: prepared.raw as any,
      ...(options ? { options } : {}),
    });
    return toSparkPayment(response.payment);
  }

  await waitForOutgoingSlot();
  const response = await walletService.sendPayment({
    prepareResponse: prepared.raw,
  } as any);
  const txId = (response as any)?.payment?.txId;
  if (typeof txId === "string" && /^[a-fA-F0-9]{64}$/.test(txId)) {
    trackOutgoingTx(txId, "liquid");
  }
  return toLiquidPayment((response as any).payment);
}

export interface ReceiveRequest {
  rail: Rail;
  /** The invoice, address, or URI to display. */
  destination: string;
  feeSat: number;
}

/**
 * Create a receive request. `method` matches the keys in `types` from
 * `$lib/utils`: lightning, bitcoin, liquid, usdt.
 */
export async function createReceiveRequest(
  method: string,
  opts: { amountSat?: number; description?: string; assetId?: string } = {},
): Promise<ReceiveRequest> {
  const rail = railForReceiveMethod(method);

  if (rail === "spark") {
    const sdk = getSparkSdk();
    if (!sdk) throw new Error("Spark rail unavailable");

    const paymentMethod =
      method === "bitcoin"
        ? ({ type: "bitcoinAddress" } as const)
        : ({
            type: "bolt11Invoice",
            description: opts.description ?? "",
            amountSats: opts.amountSat,
          } as const);

    const response = await sdk.receivePayment({ paymentMethod });
    return {
      rail,
      destination: response.paymentRequest,
      feeSat: Number(response.fee ?? 0),
    };
  }

  const prepared = await walletService.prepareReceivePayment({
    paymentMethod: "liquidAddress",
    // An L-BTC receive takes the { type: "bitcoin", payerAmountSat } variant.
    // Falling through to undefined here produced a bare address with no
    // amount, so a user asking to receive a specific sum got an address the
    // sender had to fill in by hand.
    //
    // The two variants do NOT take the same unit. `payerAmountSat` is an
    // integer in sats; `payerAmount` is in the asset's own units. `amountSat`
    // arrives here in smallest units for every asset, so the asset branch has
    // to divide by the asset's precision first — passing it raw asked for
    // 10,000,000 USDT when the user wanted 0.1.
    amount: opts.assetId
      ? {
          type: "asset",
          assetId: opts.assetId,
          payerAmount:
            opts.amountSat !== undefined
              ? toAssetUnits(opts.amountSat, opts.assetId)
              : undefined,
        }
      : opts.amountSat !== undefined
        ? { type: "bitcoin", payerAmountSat: opts.amountSat }
        : undefined,
  } as any);
  const response = await walletService.receivePayment({
    prepareResponse: prepared,
    description: opts.description,
  } as any);

  return {
    rail,
    destination: (response as any).destination,
    feeSat: Number((prepared as any)?.feesSat ?? 0),
  };
}

/**
 * Payments from both rails, merged and sorted newest first.
 *
 * A failing rail contributes nothing rather than failing the whole list —
 * a user with a degraded rail should still see the other rail's history.
 */
export async function allPayments(limit = 100): Promise<RailPayment[]> {
  const results = await Promise.allSettled([
    sparkAdapter.isConnected()
      ? sparkAdapter.listPayments(limit)
      : Promise.resolve([]),
    liquidAdapter.isConnected()
      ? liquidAdapter.listPayments(limit)
      : Promise.resolve([]),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      sdkLogger.warn(
        "[rails] listPayments failed for one rail:",
        result.reason,
      );
    }
  }

  const [sparkResult, liquidResult] = results;
  const sparkPayments =
    sparkResult.status === "fulfilled" ? sparkResult.value : [];
  const liquidPayments =
    liquidResult.status === "fulfilled" ? liquidResult.value : [];
  return mergePayments(sparkPayments, liquidPayments);
}

/** Subscribe to events from both rails. Returns a cleanup function. */
export async function subscribeRails(
  handler: (event: RailEvent) => void,
): Promise<() => Promise<void>> {
  const ids: Array<{ rail: Rail; id: string }> = [];

  for (const adapter of [sparkAdapter, liquidAdapter]) {
    if (!adapter.isConnected()) continue;
    try {
      const id = await adapter.onEvent(handler);
      ids.push({ rail: adapter.rail, id });
    } catch (error) {
      sdkLogger.error(`[rails] ${adapter.rail} listener failed:`, error);
    }
  }

  return async () => {
    for (const { rail, id } of ids) {
      try {
        await adapters[rail].offEvent(id);
      } catch (error) {
        sdkLogger.warn(`[rails] ${rail} listener cleanup failed:`, error);
      }
    }
  };
}

/**
 * Merge two rails' payments, newest first.
 *
 * Deduplication is keyed on `rail:id`, never `id` alone: the two SDKs
 * mint ids independently and a collision across rails is two different
 * payments, not one.
 */
export function mergePayments(
  a: RailPayment[],
  b: RailPayment[],
): RailPayment[] {
  const seen = new Map<string, RailPayment>();
  for (const payment of [...a, ...b]) {
    seen.set(`${payment.rail}:${payment.id}`, payment);
  }
  return [...seen.values()].sort((x, y) => y.timestamp - x.timestamp);
}
