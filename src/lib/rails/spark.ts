import * as sparkSdk from "@breeztech/breez-sdk-spark/web";
import init from "@breeztech/breez-sdk-spark/web";
import { sdkLogger } from "$lib/logger";
import type { RailAdapter, RailBalance, RailEvent, RailPayment } from "./types";
import type { RailPaymentStatus, RailPaymentMethod } from "./types";

let sdk: sparkSdk.BreezSdk | null = null;
let wasmReady = false;
/**
 * Which user the live `sdk` belongs to.
 *
 * Spark derives its wallet from the seed, so a session left open across an
 * account switch is not merely stale — it is a different person's money. The
 * Liquid side has tracked this since before the migration (walletService's
 * `currentUserId`); Spark did not, and `connect()` returned early whenever an
 * SDK existed, ignoring the mnemonic it was handed.
 */
let currentUserId: string | null = null;
let connectPromise: Promise<void> | null = null;

const STORAGE_DIR = "./spark_data";

async function initWasm(): Promise<void> {
  if (wasmReady) return;
  await init();
  wasmReady = true;
  sdkLogger.info("[rails/spark] wasm initialised");
}

/**
 * The domain Lightning addresses are registered on.
 *
 * Single source of truth for both the SDK config and every screen that
 * displays an address. The UI used to carry its own `"breez.fun"` fallback
 * while the SDK fell back to its own default of `breez.tips`, so with
 * VITE_LNURL_DOMAIN unset a user was shown one domain and registered on
 * another — the displayed address simply did not exist.
 *
 * `breez.tips` is Spark's mainnet default, verified against
 * `defaultConfig("mainnet")`. Set VITE_LNURL_DOMAIN once the DGEN subdomain
 * is CNAMEd and allowlisted by Breez.
 */
export const LNURL_DOMAIN: string =
  import.meta.env.VITE_LNURL_DOMAIN || "breez.tips";

/**
 * Close the live session and forget whose it was.
 *
 * Shared by disconnect() and by connect()'s identity-change path so the two
 * cannot drift. `sdk` is nulled regardless of whether disconnect() rejects:
 * leaving it set would keep isConnected() reporting true for a torn-down
 * session, and connect()'s guard would then no-op forever.
 */
async function closeSdk(): Promise<void> {
  if (!sdk) {
    currentUserId = null;
    return;
  }
  try {
    await sdk.disconnect();
  } catch (error) {
    sdkLogger.warn("[rails/spark] disconnect failed:", error);
  } finally {
    sdk = null;
    currentUserId = null;
  }
  sdkLogger.info("[rails/spark] disconnected");
}

function buildConfig(): sparkSdk.Config {
  const config = sparkSdk.defaultConfig("mainnet");

  const apiKey =
    import.meta.env.VITE_SPARK_API_KEY || import.meta.env.VITE_BREEZ_API_KEY;
  if (!apiKey) {
    throw new Error("Spark API key not found in environment variables");
  }
  config.apiKey = apiKey;

  // Always set it, even when it equals the SDK's own default, so the value
  // the UI displays and the value the SDK registers on cannot drift apart.
  config.lnurlDomain = LNURL_DOMAIN;

  // Deposits are claimed automatically up to this ceiling. The SDK default
  // is 1 sat/vbyte (~99 sats), below any provider spread, which would leave
  // deposits unclaimed whenever fees rise (spec 7). Use the recommended
  // rate at claim time instead; anything above it goes to manual claim.
  config.maxDepositClaimFee = {
    type: "networkRecommended",
    leewaySatPerVbyte: 2,
  };

  return config;
}

/**
 * The www host, deliberately, not the apex.
 *
 * The SDK's own `getSparkStatus()` requests `https://spark.money/api/v1/status`,
 * which answers 301 to this host. That redirect is served by a plain CDN rule
 * and carries no `access-control-allow-origin`, and a browser applies the CORS
 * check to EVERY hop of a redirect chain — so the request dies on the 301 as an
 * opaque "TypeError: Failed to fetch". Verified on the deployed app: the apex
 * 301 has no ACAO header, the www response has `access-control-allow-origin: *`,
 * and curl succeeds on both because it does not enforce CORS. The banner
 * therefore told every user the network was unreachable while Spark itself was
 * reporting "operational".
 *
 * Requesting www directly skips the redirect entirely. Revisit if the SDK stops
 * hardcoding the apex.
 */
const SPARK_STATUS_URL = "https://www.spark.money/api/v1/status";

/**
 * Spark network health. Breez's production checklist requires surfacing this.
 *
 * Fetched directly rather than through the SDK, for the CORS reason above. A
 * side benefit: this no longer needs the wasm module, so the status banner can
 * resolve immediately on page load instead of waiting on `init()`.
 */
export async function getSparkNetworkStatus(): Promise<sparkSdk.ServiceStatus> {
  try {
    const response = await fetch(SPARK_STATUS_URL);
    if (!response.ok) {
      throw new Error(`status endpoint returned ${response.status}`);
    }
    const body = (await response.json()) as { status?: string };
    return (body.status ?? "unknown") as sparkSdk.ServiceStatus;
  } catch (error) {
    sdkLogger.warn("[rails/spark] status check failed:", error);
    return "unknown";
  }
}

function mapStatus(status: unknown): RailPaymentStatus {
  switch (status) {
    case "completed":
      return "complete";
    case "failed":
      return "failed";
    default:
      // pending and anything unrecognised. Never drop a payment.
      return "pending";
  }
}

function mapMethod(method: unknown): RailPaymentMethod {
  switch (method) {
    case "deposit":
    case "withdraw":
      return "onchain";
    case "spark":
      return "spark";
    case "token":
      return "token";
    default:
      return "lightning";
  }
}

/**
 * Exported for tests. Maps a Spark SDK payment into the shared shape.
 *
 * Spark returns bigint amounts; they convert to number here and nowhere
 * else. Max possible sats (2.1e15) is well inside Number.MAX_SAFE_INTEGER
 * (9.0e15), so this is lossless for any real balance.
 */
export function toRailPayment(payment: unknown): RailPayment {
  const p = payment as Record<string, any>;
  const method = mapMethod(p.method);

  // Spark reuses one `amount` field for every method, but a token payment's
  // amount is in the token's own units, not sats. Reporting it as sats would
  // render 100 USDB as 1 BTC. Tokens are out of scope (spec 9) and should
  // never appear; if one does, keep it visible with a zero amount and the
  // true value in `raw` rather than displaying a fabricated figure.
  const isToken = method === "token";
  if (isToken) {
    sdkLogger.warn(
      `[rails/spark] token payment ${p.id} — amount not in sats, reporting 0`,
    );
  }

  return {
    id: String(p.id ?? ""),
    rail: "spark",
    direction: p.paymentType === "send" ? "send" : "receive",
    status: mapStatus(p.status),
    amountSat: isToken ? 0 : Number(p.amount ?? 0),
    feeSat: isToken ? 0 : Number(p.fees ?? 0),
    timestamp: Number(p.timestamp ?? 0),
    method,
    raw: payment,
  };
}

export const sparkAdapter: RailAdapter = {
  rail: "spark",

  async connect(mnemonic: string, userId?: string): Promise<void> {
    const identity = userId ?? null;

    // Already connected as this user: nothing to do.
    if (sdk && currentUserId === identity && !connectPromise) return;

    // Connected as SOMEBODY ELSE. Tear the old session down rather than
    // returning early — the previous guard (`if (connecting || sdk) return`)
    // meant that after an in-app account switch user B kept operating on user
    // A's Spark wallet: A's balance on screen, A's funds on every send.
    if (sdk && currentUserId !== identity) {
      sdkLogger.info("[rails/spark] identity changed, reconnecting");
      await closeSdk();
    }

    // Concurrent callers await the attempt in flight. Returning immediately
    // instead handed the caller a connection that did not exist yet, so its
    // isConnected() check marked a healthy rail "unavailable" and no event
    // listener was ever attached.
    if (connectPromise) return connectPromise;

    connectPromise = (async () => {
      try {
        await initWasm();
        sdk = await sparkSdk.connect({
          config: buildConfig(),
          seed: { type: "mnemonic", mnemonic },
          storageDir: STORAGE_DIR,
        });
        currentUserId = identity;
        sdkLogger.info("[rails/spark] connected");
      } catch (error) {
        sdk = null;
        currentUserId = null;
        sdkLogger.error("[rails/spark] connection failed:", error);
        throw error;
      }
    })();

    try {
      await connectPromise;
    } finally {
      connectPromise = null;
    }
  },

  async disconnect(): Promise<void> {
    await closeSdk();
  },

  isConnected(): boolean {
    return sdk !== null;
  },

  async getBalance(): Promise<RailBalance> {
    if (!sdk) return { rail: "spark", balanceSat: 0 };
    const info = await sdk.getInfo({});
    return { rail: "spark", balanceSat: Number(info.balanceSats ?? 0) };
  },

  async listPayments(limit = 100): Promise<RailPayment[]> {
    if (!sdk) return [];
    const response = await sdk.listPayments({ limit });
    return (response.payments ?? []).map(toRailPayment);
  },

  async onEvent(handler: (event: RailEvent) => void): Promise<string> {
    if (!sdk) throw new Error("Spark SDK not connected");
    return await sdk.addEventListener({
      onEvent: (event: sparkSdk.SdkEvent) => {
        switch (event.type) {
          case "synced":
            handler({ type: "synced", rail: "spark" });
            break;
          case "paymentSucceeded":
            handler({
              type: "paymentSucceeded",
              rail: "spark",
              payment: toRailPayment(event.payment),
            });
            break;
          case "paymentPending":
            handler({
              type: "paymentPending",
              rail: "spark",
              payment: toRailPayment(event.payment),
            });
            break;
          case "paymentFailed":
            handler({
              type: "paymentFailed",
              rail: "spark",
              payment: toRailPayment(event.payment),
            });
            break;
          case "unclaimedDeposits":
            handler({
              type: "depositsNeedClaim",
              rail: "spark",
              count: event.unclaimedDeposits?.length ?? 0,
            });
            break;
          case "claimedDeposits":
          case "newDeposits":
            break;
          default:
            sdkLogger.debug(`[rails/spark] unmapped event: ${event.type}`);
        }
        handler({ type: "balanceChanged", rail: "spark" });
      },
    });
  },

  async offEvent(id: string): Promise<void> {
    if (!sdk || !id) return;
    await sdk.removeEventListener(id);
  },
};

/** Internal accessor for sibling modules in this directory. */
export function getSparkSdk(): sparkSdk.BreezSdk | null {
  return sdk;
}

/**
 * A registered Lightning address, shaped for this app's existing consumers.
 *
 * Spark returns `lnurl` as `{ url, bech32 }`, but `lnAddressStore.setSuccess`
 * and the profile POST both expect a string, so it is flattened here rather
 * than at every call site. `bip353Address` has no Spark equivalent — the old
 * breez.fun flow supplied it — so it is always undefined; the store already
 * coerces that to null, and PaymentDetails reads its own copy off historical
 * payment details, not from here.
 */
export interface SparkLightningAddress {
  username: string;
  lightningAddress: string;
  description: string;
  /** bech32 form, falling back to the raw URL. */
  lnurl: string;
  bip353Address?: undefined;
}

function toAddressResult(info: unknown): SparkLightningAddress {
  const i = info as {
    username?: string;
    lightningAddress?: string;
    description?: string;
    lnurl?: { url?: string; bech32?: string };
  };
  return {
    username: i.username ?? "",
    lightningAddress: i.lightningAddress ?? "",
    description: i.description ?? "",
    lnurl: i.lnurl?.bech32 || i.lnurl?.url || "",
    bip353Address: undefined,
  };
}

export async function checkLightningAddressAvailable(
  username: string,
): Promise<boolean> {
  const sdk = getSparkSdk();
  if (!sdk) throw new Error("Spark rail unavailable");
  return await sdk.checkLightningAddressAvailable({ username });
}

export async function registerLightningAddress(
  username: string,
  description?: string,
): Promise<SparkLightningAddress> {
  const sdk = getSparkSdk();
  if (!sdk) throw new Error("Spark rail unavailable");
  const info = await sdk.registerLightningAddress({ username, description });
  return toAddressResult(info);
}

export async function getLightningAddress(): Promise<SparkLightningAddress | null> {
  const sdk = getSparkSdk();
  if (!sdk) return null;
  const info = await sdk.getLightningAddress();
  return info ? toAddressResult(info) : null;
}

export async function deleteLightningAddress(): Promise<void> {
  const sdk = getSparkSdk();
  if (!sdk) throw new Error("Spark rail unavailable");
  await sdk.deleteLightningAddress();
}

/**
 * A deposit the automatic ceiling would not cover.
 *
 * `requiredFeeSats` comes from the SDK's own claim error and is the exact
 * fee needed. Never invent a ceiling from the deposit amount — that would
 * permit a fee up to 100% of the deposit.
 */
export interface UnclaimedDeposit {
  txid: string;
  vout: number;
  amountSats: number;
  isMature: boolean;
  requiredFeeSats?: number;
}

export async function listUnclaimedDeposits(): Promise<UnclaimedDeposit[]> {
  const sdk = getSparkSdk();
  if (!sdk) return [];
  const response = await sdk.listUnclaimedDeposits({});
  return (response.deposits ?? []).map((d) => {
    const error = d.claimError as
      | { type: string; requiredFeeSats?: number }
      | undefined;
    return {
      txid: d.txid,
      vout: d.vout,
      amountSats: Number(d.amountSats ?? 0),
      isMature: Boolean(d.isMature),
      requiredFeeSats:
        error?.type === "maxDepositClaimFeeExceeded"
          ? Number(error.requiredFeeSats ?? 0)
          : undefined,
    };
  });
}

/**
 * Claim a deposit the automatic ceiling would not cover.
 *
 * `maxFeeSat` must be at least the SDK's quoted fee, or the call returns
 * MaxDepositClaimFeeExceeded and the deposit waits for maturity instead.
 * Pass the deposit's `requiredFeeSats` — nothing larger.
 *
 * Note: the docs describe `fetchClaimDepositQuote`, which does NOT exist in
 * pinned 0.23.0 (the docs track main). The claim error carries the fee
 * instead. Revisit on the next SDK bump.
 */
export async function claimDeposit(
  txid: string,
  vout: number,
  maxFeeSat: number,
): Promise<void> {
  const sdk = getSparkSdk();
  if (!sdk) throw new Error("Spark rail unavailable");
  await sdk.claimDeposit({
    txid,
    vout,
    maxFee: { type: "fixed", amount: maxFeeSat },
  });
}
