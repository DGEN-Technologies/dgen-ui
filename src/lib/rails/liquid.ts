import * as walletService from "$lib/walletService";
import { ASSET_IDS } from "$lib/assets";
import { sdkLogger } from "$lib/logger";
import type {
  RailAdapter,
  RailBalance,
  RailEvent,
  RailPayment,
  RailPaymentStatus,
  RailPaymentMethod,
} from "./types";

function mapStatus(status: unknown): RailPaymentStatus {
  switch (status) {
    case "complete":
      return "complete";
    case "failed":
    case "refunded":
      return "failed";
    default:
      // pending, waitingFeeAcceptance, waitingConfirmation and anything
      // unrecognised are all "not done yet". Never drop a payment.
      return "pending";
  }
}

function mapMethod(assetId?: string): RailPaymentMethod {
  return assetId === ASSET_IDS.USDT ? "usdt" : "liquid";
}

/** Exported for tests. Maps a Liquid SDK payment into the shared shape. */
export function toRailPayment(payment: unknown): RailPayment {
  const p = payment as Record<string, any>;
  const timestamp = Number(p.paymentTime ?? p.timestamp ?? 0);
  const amountSat = Number(p.amountSat ?? 0);
  const direction = p.paymentType === "send" ? "send" : "receive";
  const assetId: string | undefined = p.details?.assetId;

  return {
    id: p.txId || `liquid_${timestamp}_${amountSat}_${direction}`,
    rail: "liquid",
    direction,
    status: mapStatus(p.status),
    amountSat,
    feeSat: Number(p.feesSat ?? 0),
    timestamp,
    method: mapMethod(assetId),
    assetId,
    raw: payment,
  };
}

let listenerId: string | null = null;

export const liquidAdapter: RailAdapter = {
  rail: "liquid",

  async connect(mnemonic: string, userId?: string): Promise<void> {
    // userId must be forwarded: walletService uses it to detect an account
    // switch and force a config refresh. Dropping it silently reuses the
    // previous user's SDK session.
    await walletService.initWallet(mnemonic, userId);
  },

  async disconnect(): Promise<void> {
    await walletService.disconnect();
  },

  isConnected(): boolean {
    return walletService.isConnected();
  },

  async getBalance(): Promise<RailBalance> {
    const info = await walletService.getWalletInfo();
    // getWalletInfo() swallows its own errors and returns null, so a
    // transient failure is indistinguishable from a real zero here. Throwing
    // lets refreshBalances() keep the last known good figure instead of
    // overwriting it with 0 and still reporting "connected".
    if (!info && walletService.isConnected()) {
      throw new Error("Liquid balance fetch failed");
    }
    const wallet = (info as any)?.walletInfo;
    return {
      rail: "liquid",
      balanceSat: Number(wallet?.balanceSat ?? 0),
      // Read `balanceSat` (required on the SDK's AssetBalance), never
      // `balance` (optional, and not the sats figure). Pass `name` and
      // `ticker` through — AssetBalances.svelte renders both.
      assets: (wallet?.assetBalances ?? []).map((a: any) => ({
        assetId: a.assetId,
        balanceSat: Number(a.balanceSat ?? 0),
        name: a.name,
        ticker: a.ticker,
      })),
    };
  },

  async listPayments(limit = 100): Promise<RailPayment[]> {
    const payments = await walletService.getTransactions({ limit });
    return (payments ?? []).map(toRailPayment);
  },

  async onEvent(handler: (event: RailEvent) => void): Promise<string> {
    listenerId = await walletService.addEventListener((sdkEvent: any) => {
      const payment = sdkEvent?.details
        ? toRailPayment(sdkEvent.details)
        : undefined;

      switch (sdkEvent?.type) {
        case "synced":
          handler({ type: "synced", rail: "liquid" });
          break;
        case "paymentSucceeded":
          if (payment)
            handler({ type: "paymentSucceeded", rail: "liquid", payment });
          break;
        // Not settled yet. mapStatus() already treats this as pending, and
        // telling the user "received" for funds that may still fail or need
        // a refund is worse than telling them late.
        case "paymentWaitingConfirmation":
        case "paymentPending":
        case "paymentWaitingFeeAcceptance":
          if (payment)
            handler({ type: "paymentPending", rail: "liquid", payment });
          break;
        case "paymentFailed":
        case "paymentRefundable":
          if (payment)
            handler({ type: "paymentFailed", rail: "liquid", payment });
          break;
        default:
          sdkLogger.debug(`[rails/liquid] unmapped event: ${sdkEvent?.type}`);
      }
      handler({ type: "balanceChanged", rail: "liquid" });
    });
    return listenerId;
  },

  async offEvent(id: string): Promise<void> {
    await walletService.removeEventListener(id);
    if (listenerId === id) listenerId = null;
  },
};
