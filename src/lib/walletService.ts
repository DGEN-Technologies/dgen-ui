import * as breezSdk from "@breeztech/breez-sdk-liquid/web";
import init from "@breeztech/breez-sdk-liquid/web";
import { env as publicEnv } from "$env/dynamic/public";
import * as bip39 from "bip39";
import { SecureStorage } from "./secureStorage";
import { initBreezLogger, sdkLogger, lightningAddressLogger } from "./logger";
import { trackPendingTx } from "./esplora/PollManager";
import { trackOutgoingTx, waitForOutgoingSlot } from "./sendGate";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { walletUnlockLimiter, paymentLimiter } from "./security/rateLimiter";
import { mapTxError } from "./txErrors";

export const resolveLightningAddress = async (
  address: string,
): Promise<breezSdk.LnUrlPayRequestData> => {
  const response = await fetch(
    `/api/lnurl/resolve?address=${encodeURIComponent(address.trim())}`,
  );
  if (!response.ok) {
    const detail = await response.text();
    sdkLogger.warn("Lightning address lookup failed", {
      status: response.status,
      detail: detail?.slice(0, 200),
    });
    throw new Error(`Lightning address lookup failed (${response.status})`);
  }
  return (await response.json()) as breezSdk.LnUrlPayRequestData;
};

// Private SDK instance - not exposed outside this module
let sdk: breezSdk.BindingLiquidSdk | null = null;
let wasmInitialized = false;
let eventListeners: Map<string, string> = new Map(); // Track listener IDs
let currentUserId: string | null = null;
let isConnecting = false; // Prevent concurrent connections
const SDK_CONFIG_VERSION = 5;
const SDK_CONFIG_VERSION_KEY = "breez_sdk_config_version";

// Secure storage instance
const secureStorage = SecureStorage.getInstance();

const normalizeExplorerUrl = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const isLocalhost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !isLocalhost) {
      sdkLogger.warn("Explorer URL must use https:", parsed.toString());
      return null;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    sdkLogger.warn("Invalid explorer URL:", trimmed);
    return null;
  }
};

const buildBackendExplorerUrl = (
  networkPath: "bitcoin" | "liquid",
): string | null => {
  const base = publicEnv.PUBLIC_DGEN_URL;
  if (!base) return null;
  try {
    const url = new URL(`/api/esplora/${networkPath}`, base);
    return normalizeExplorerUrl(url.toString());
  } catch {
    return null;
  }
};

const resolveExplorerOverride = (
  explicitValue: string | undefined,
  fallbackNetwork?: "bitcoin" | "liquid",
): string | null => {
  const explicit = normalizeExplorerUrl(explicitValue);
  if (explicit) return explicit;
  if (!fallbackNetwork) return null;
  return buildBackendExplorerUrl(fallbackNetwork);
};

const redactUrl = (value: string): string => {
  try {
    const url = new URL(value);
    return `${url.origin}/...`;
  } catch {
    return "<invalid-url>";
  }
};

const summarizeOffer = (offer?: string): string => {
  if (!offer) return "<none>";
  return `len:${offer.length}`;
};

/**
 * Gets or generates a persistent encryption password for the user's wallet.
 * This key is:
 * - Generated randomly on first use (secure, unpredictable)
 * - Stored in IndexedDB (persists across sessions for good UX)
 * - User-specific (different per user)
 * - Used to encrypt/decrypt mnemonic stored locally in IndexedDB
 *
 * Security model: Fully client-side storage. The mnemonic never leaves the browser.
 * Both encryption key and encrypted mnemonic are in IndexedDB, protected by browser same-origin policy.
 */
export async function getWalletPassword(userId: string): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Secure wallet storage unavailable on server");
  }

  const storageKey = `walletEncryptionKey_${userId}`;

  try {
    const db = await openWalletKeysDB();
    const existingKey = await getFromDB(db, storageKey);

    if (existingKey) {
      return existingKey;
    }

    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const newKey = bytesToHex(randomBytes);

    await saveToDB(db, storageKey, newKey);

    sdkLogger.info("Generated new wallet encryption key");
    return newKey;
  } catch (error) {
    sdkLogger.error("Failed to get/generate wallet password:", error);
    throw new Error("Secure wallet storage unavailable");
  }
}

async function openWalletKeysDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("dgen_wallet_keys", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("keys")) {
        db.createObjectStore("keys");
      }
    };
  });
}

async function getFromDB(db: IDBDatabase, key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["keys"], "readonly");
    const store = transaction.objectStore("keys");
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveToDB(
  db: IDBDatabase,
  key: string,
  value: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["keys"], "readwrite");
    const store = transaction.objectStore("keys");
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Initialize WASM module once
export const initWasm = async (): Promise<void> => {
  if (wasmInitialized) {
    return;
  }

  try {
    await init();
    wasmInitialized = true;

    // Initialize Breez SDK logger
    initBreezLogger();
    sdkLogger.info("WASM module initialized successfully");
  } catch (error) {
    sdkLogger.error("Failed to initialize WASM module:", error);
    throw error;
  }
};

// Check if SDK is connected
export const isConnected = (): boolean => {
  return sdk !== null;
};

export const waitForSdk = async (
  options: { maxAttempts?: number; delayMs?: number } = {},
): Promise<boolean> => {
  const { maxAttempts = 20, delayMs = 500 } = options;
  let attempts = 0;
  while (!isConnected() && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    attempts += 1;
  }
  return isConnected();
};

// Main wallet initialization function
export const initWallet = async (
  mnemonic: string,
  userId?: string,
): Promise<void> => {
  // Prevent concurrent connections
  if (isConnecting) {
    return;
  }

  const needsConfigRefresh = (() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(SDK_CONFIG_VERSION_KEY);
    return stored !== String(SDK_CONFIG_VERSION);
  })();

  // If already connected for this user and config is current, just return
  if (sdk && currentUserId === userId && !needsConfigRefresh) {
    return;
  }

  try {
    isConnecting = true;

    // Disconnect existing SDK if switching users or config version changed
    if (sdk && (currentUserId !== userId || needsConfigRefresh)) {
      await disconnect();
    }

    // Store current user
    currentUserId = userId || null;

    // Initialize WASM if needed
    await initWasm();

    // Connect to SDK with mnemonic
    await connectSdk(mnemonic);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        SDK_CONFIG_VERSION_KEY,
        String(SDK_CONFIG_VERSION),
      );
    }
  } catch (error) {
    throw error;
  } finally {
    isConnecting = false;
  }
};

// Connect SDK with mnemonic (internal)
const connectSdk = async (mnemonic: string, retryCount = 0): Promise<void> => {
  const maxRetries = 3;

  try {
    if (!mnemonic) {
      throw new Error("Mnemonic is required to connect SDK");
    }

    // Validate mnemonic before connecting
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error("Invalid mnemonic phrase");
    }

    const config = breezSdk.defaultConfig("mainnet");

    // Configure working directory - same as wasm-example-app
    config.workingDir = "./breez_data";

    // Get API key from environment
    const breezApiKey = import.meta.env.VITE_BREEZ_API_KEY;
    if (!breezApiKey) {
      throw new Error("Breez API key not found in environment variables");
    }
    config.breezApiKey = breezApiKey;

    const bitcoinExplorerUrl = resolveExplorerOverride(
      import.meta.env.VITE_BITCOIN_EXPLORER_URL,
      "bitcoin",
    );
    // Explorer overrides:
    // - Bitcoin is routed through our backend proxy (enterprise tokens applied server-side).
    // - Liquid stays on Breez defaults to preserve Breez-only endpoints (Option A).
    if (bitcoinExplorerUrl) {
      config.bitcoinExplorer = {
        type: "esplora",
        url: bitcoinExplorerUrl,
        useWaterfalls: false,
      };
    }

    sdkLogger.info(
      `[SDK] Explorer config: bitcoin=${config.bitcoinExplorer.url} useWaterfalls=${config.bitcoinExplorer.useWaterfalls}; liquid=${config.liquidExplorer.url} useWaterfalls=${config.liquidExplorer.useWaterfalls}`,
    );

    // Note: The SDK already includes default asset metadata for LBTC and USDT on mainnet
    // Additional assets can be added here if needed
    // config.assetMetadata = [...(config.assetMetadata || []), { additional assets }];

    if (retryCount > 0) {
      // Add exponential backoff delay to help avoid blockstream.info rate limits (429 errors)
      // This is especially important when multiple apps are running or on retries
      const delayMs = 5000 * Math.pow(2, retryCount - 1); // 5s, 10s, 20s
      sdkLogger.info(
        `Connecting to SDK (attempt ${retryCount + 1}/${maxRetries + 1}) with ${delayMs}ms delay...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } else {
      sdkLogger.info(
        `Connecting to SDK (attempt ${retryCount + 1}/${maxRetries + 1})...`,
      );
    }

    // Connect to Breez network with the mnemonic directly - exactly like wasm-example-app
    sdk = await breezSdk.connect({
      config,
      mnemonic,
    });

    sdkLogger.info("SDK connected successfully");

    // SDK handles syncing automatically - no manual sync needed
  } catch (error) {
    sdkLogger.error(
      `Connection failed (attempt ${retryCount + 1}/${maxRetries + 1}):`,
      error,
    );

    // Check if this is a rate limit or network error that we can retry
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryable =
      errorMessage.includes("429") ||
      errorMessage.includes("Too Many Requests") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("network") ||
      errorMessage.includes("fetch");

    if (isRetryable && retryCount < maxRetries) {
      sdkLogger.warn(
        `Retryable error detected, retrying connection (${retryCount + 1}/${maxRetries})...`,
      );
      sdk = null;
      // Recursive retry with incremented count
      return await connectSdk(mnemonic, retryCount + 1);
    }

    sdk = null;
    throw error;
  }
};

// Generate new mnemonic
export const generateMnemonic = (): string => {
  return bip39.generateMnemonic(128); // 12 words
};

// Validate mnemonic
export const validateMnemonic = (mnemonic: string): boolean => {
  return bip39.validateMnemonic(mnemonic);
};

// Save mnemonic to secure storage with user password
export const saveMnemonic = async (
  mnemonic: string,
  userPassword: string,
  userId?: string,
): Promise<void> => {
  await secureStorage.init();
  const effectiveUserId = userId || currentUserId || "default";
  await secureStorage.unlock(userPassword, effectiveUserId);

  const storageKey = `walletMnemonic_${effectiveUserId}`;
  await secureStorage.store(storageKey, mnemonic);

  // Clear from memory immediately after storing (MyAlgo vulnerability mitigation)
  mnemonic = "";
};

// Get saved mnemonic from secure storage with user password
export const getSavedMnemonic = async (
  userPassword: string,
  userId?: string,
): Promise<string | null> => {
  try {
    await secureStorage.init();
    const effectiveUserId = userId || currentUserId || "default";
    const storageKey = `walletMnemonic_${effectiveUserId}`;

    // Try with new random key first
    try {
      await secureStorage.unlock(userPassword, effectiveUserId);
      const mnemonic = await secureStorage.retrieve(storageKey);

      if (mnemonic) {
        sdkLogger.info(
          `[Migration] Successfully retrieved wallet with new random key`,
        );
        return mnemonic;
      }
    } catch (error) {
      sdkLogger.info(`[Migration] New key failed, trying legacy keys...`);
    }

    // Fallback 1: Try with userId directly (for wallets created with the layout bug)
    try {
      await secureStorage.unlock(effectiveUserId, effectiveUserId);
      const mnemonic = await secureStorage.retrieve(storageKey);

      if (mnemonic) {
        sdkLogger.info(
          `[Migration] Found wallet encrypted with userId (bug migration) - migrating to new random key`,
        );

        // Re-encrypt with new random key
        await secureStorage.unlock(userPassword, effectiveUserId);
        await secureStorage.store(storageKey, mnemonic);

        sdkLogger.info(
          `[Migration] Successfully migrated wallet from buggy encryption to new random key`,
        );
        return mnemonic;
      }
    } catch (migrationError) {
      sdkLogger.info(
        `[Migration] userId key also failed, trying old static key...`,
      );
    }

    // Fallback 2: Try with old static key for migration
    const oldStaticPassword = `wallet-key-${effectiveUserId}`;
    try {
      await secureStorage.unlock(oldStaticPassword, effectiveUserId);
      const mnemonic = await secureStorage.retrieve(storageKey);

      if (mnemonic) {
        sdkLogger.info(
          `[Migration] Found wallet encrypted with old static key - migrating to new random key`,
        );

        // Re-encrypt with new random key
        await secureStorage.unlock(userPassword, effectiveUserId);
        await secureStorage.store(storageKey, mnemonic);

        sdkLogger.info(
          `[Migration] Successfully migrated wallet to new random key`,
        );
        return mnemonic;
      }
    } catch (migrationError) {
      sdkLogger.info(
        `[Migration] Old static key also failed - no wallet found`,
      );
    }

    return null;
  } catch (error) {
    sdkLogger.error("[getSavedMnemonic] Error:", error);
    return null;
  }
};

// Clear mnemonic from secure storage
export const clearMnemonic = async (
  userPassword: string,
  userId?: string,
): Promise<void> => {
  try {
    await secureStorage.init();
    const effectiveUserId = userId || currentUserId || "default";
    await secureStorage.unlock(userPassword, effectiveUserId);

    const storageKey = `walletMnemonic_${effectiveUserId}`;
    await secureStorage.remove(storageKey);
  } catch (error) {
    console.error("Failed to clear mnemonic:", error);
  }
};

// Get wallet info
export const getWalletInfo =
  async (): Promise<breezSdk.GetInfoResponse | null> => {
    if (!sdk) {
      sdkLogger.warn("Not initialized when getting wallet info");
      return null;
    }

    try {
      const info = await sdk.getInfo();
      return info;
    } catch (error) {
      sdkLogger.error("Failed to get wallet info:", error);
      return null;
    }
  };

// Get transactions with optional filtering
export const getTransactions = async (filter?: {
  fromTimestamp?: number;
  toTimestamp?: number;
  filters?: breezSdk.PaymentType[];
  offset?: number;
  limit?: number;
}): Promise<breezSdk.Payment[]> => {
  if (!sdk) {
    sdkLogger.warn("Not initialized when getting transactions");
    return [];
  }

  try {
    const payments = await sdk.listPayments({
      sortAscending: false, // Most recent first
      fromTimestamp: filter?.fromTimestamp,
      toTimestamp: filter?.toTimestamp,
      filters: filter?.filters,
      offset: filter?.offset,
      limit: filter?.limit,
    });
    return payments;
  } catch (error) {
    sdkLogger.error("Failed to get transactions:", error);
    return [];
  }
};

// SDK handles syncing automatically - no manual sync needed
// The SDK will sync on its own schedule and emit 'synced' events

// Payment Operations
export const parseInput = async (
  input: string,
): Promise<breezSdk.InputType> => {
  if (!sdk) throw new Error("SDK not initialized");
  let trimmed = input?.trim() ?? "";
  const lowerRaw = trimmed.toLowerCase();
  if (lowerRaw.startsWith("lightning:")) {
    trimmed = trimmed.slice("lightning:".length).trim();
  }
  const lower = trimmed.toLowerCase();

  // Short-circuit Lightning Address resolution via backend proxy to avoid CSP issues
  if (trimmed && trimmed.includes("@") && !lower.startsWith("lnurl")) {
    const data = await resolveLightningAddress(trimmed);
    return { type: "lnUrlPay", data };
  }
  if (trimmed && lower.startsWith("lnurl")) {
    const data = await resolveLightningAddress(trimmed);
    return { type: "lnUrlPay", data };
  }
  if (
    trimmed &&
    !trimmed.includes("@") &&
    (lower.startsWith("http://") ||
      lower.startsWith("https://") ||
      lower.startsWith("lnurl")) &&
    trimmed.includes("/")
  ) {
    const data = await resolveLightningAddress(trimmed);
    return { type: "lnUrlPay", data };
  }

  try {
    return await sdk.parse(trimmed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error || "");
    if (trimmed && trimmed.includes("@")) {
      try {
        return await sdk.parse(`lightning:${trimmed}`);
      } catch (retryError) {
        try {
          const data = await resolveLightningAddress(trimmed);
          return { type: "lnUrlPay", data };
        } catch {
          throw retryError;
        }
      }
    }
    throw error instanceof Error ? error : new Error(message);
  }
};

export const prepareSendPayment = async (
  params: breezSdk.PrepareSendRequest,
): Promise<breezSdk.PrepareSendResponse> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.prepareSendPayment(params);
};

export const sendPayment = async (
  params: breezSdk.SendPaymentRequest,
): Promise<breezSdk.SendPaymentResponse> => {
  if (!sdk) throw new Error("SDK not initialized");
  await waitForOutgoingSlot();
  try {
    const response = await sdk.sendPayment(params);
    const txId = response?.payment?.txId;
    if (typeof txId === "string" && /^[a-fA-F0-9]{64}$/.test(txId)) {
      sdkLogger.info("SendPayment broadcast txId:", txId);
      // Kick off fast polling immediately to reduce stale-UTXO follow-ups.
      trackPendingTx(txId, "liquid");
      trackOutgoingTx(txId, "liquid");
    } else if (txId) {
      sdkLogger.warn("SendPayment returned non-txid identifier:", txId);
    }
    return response;
  } catch (error) {
    sdkLogger.error("SendPayment failed:", error);
    const message =
      error instanceof Error ? error.message : String(error || "");
    throw new Error(mapTxError(message, "Payment failed"));
  }
};

// Receiving Operations
export const fetchLightningLimits =
  async (): Promise<breezSdk.LightningPaymentLimitsResponse> => {
    if (!sdk) throw new Error("SDK not initialized");
    return await sdk.fetchLightningLimits();
  };

export const fetchOnchainLimits =
  async (): Promise<breezSdk.OnchainPaymentLimitsResponse> => {
    if (!sdk) throw new Error("SDK not initialized");
    return await sdk.fetchOnchainLimits();
  };

export const prepareReceivePayment = async (
  params: breezSdk.PrepareReceiveRequest,
): Promise<breezSdk.PrepareReceiveResponse> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.prepareReceivePayment(params);
};

export const receivePayment = async (params: {
  prepareResponse: breezSdk.PrepareReceiveResponse;
  description?: string;
  useDescriptionHash?: boolean;
  payerNote?: string;
}): Promise<breezSdk.ReceivePaymentResponse> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.receivePayment(params);
};

// Fiat rate operations
export const fetchFiatRates = async (): Promise<breezSdk.Rate[]> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.fetchFiatRates();
};

// Onchain operations
export const recommendedFees = async (): Promise<breezSdk.RecommendedFees> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.recommendedFees();
};

// Refund operations (Bitcoin on-chain swaps)
export const listRefundables = async (): Promise<breezSdk.RefundableSwap[]> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.listRefundables();
};

export const prepareRefund = async (
  params: breezSdk.PrepareRefundRequest,
): Promise<breezSdk.PrepareRefundResponse> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.prepareRefund(params);
};

export const refundSwap = async (
  params: breezSdk.RefundRequest,
): Promise<breezSdk.RefundResponse> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.refund(params);
};

export const rescanOnchainSwaps = async (): Promise<void> => {
  if (!sdk) throw new Error("SDK not initialized");
  await sdk.rescanOnchainSwaps();
};

export const preparePayOnchain = async (
  params: breezSdk.PreparePayOnchainRequest,
): Promise<breezSdk.PreparePayOnchainResponse> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.preparePayOnchain(params);
};

export const payOnchain = async (
  params: breezSdk.PayOnchainRequest,
): Promise<breezSdk.SendPaymentResponse> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.payOnchain(params);
};

export const prepareBuyBitcoin = async (
  params: breezSdk.PrepareBuyBitcoinRequest,
): Promise<breezSdk.PrepareBuyBitcoinResponse> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.prepareBuyBitcoin(params);
};

export const buyBitcoin = async (
  params: breezSdk.BuyBitcoinRequest,
): Promise<string> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.buyBitcoin(params);
};

// Event handling
export const addEventListener = async (
  callback: (event: breezSdk.SdkEvent) => void,
): Promise<string> => {
  if (!sdk) {
    throw new Error("SDK not initialized");
  }

  try {
    const listener: breezSdk.EventListener = {
      onEvent: callback,
    };

    const listenerId = await sdk.addEventListener(listener);
    // Use the listenerId as the key to allow multiple listeners
    eventListeners.set(listenerId, listenerId);
    return listenerId;
  } catch (error) {
    sdkLogger.error("Failed to add event listener:", error);
    throw error;
  }
};

// Remove event listener
export const removeEventListener = async (
  listenerId: string,
): Promise<void> => {
  if (!sdk || !listenerId) return;

  try {
    await sdk.removeEventListener(listenerId);

    // Remove from tracking
    for (const [key, id] of eventListeners) {
      if (id === listenerId) {
        eventListeners.delete(key);
        break;
      }
    }
  } catch (error) {
    sdkLogger.error("Failed to remove event listener:", error);
  }
};

// Disconnect and cleanup
export const disconnect = async (): Promise<void> => {
  if (sdk) {
    try {
      // Remove all event listeners
      for (const [key, listenerId] of eventListeners) {
        try {
          await sdk.removeEventListener(listenerId);
        } catch (error) {
          sdkLogger.error(`Failed to remove listener ${key}:`, error);
        }
      }
      eventListeners.clear();

      // Disconnect SDK
      await sdk.disconnect();
      sdk = null;
      currentUserId = null;
    } catch (error) {
      sdkLogger.error("Failed to disconnect:", error);
      sdk = null;
      currentUserId = null;
    }
  }
};

// Lock wallet (clear session but keep mnemonic in secure storage)
export const lockWallet = async (): Promise<void> => {
  await disconnect();
  await secureStorage.lock();
};

// Unlock wallet (restore session)
export const unlockWallet = async (
  password: string,
  userId?: string,
): Promise<void> => {
  const effectiveUserId = userId || currentUserId || "default";

  // Check rate limit
  const rateLimitCheck = walletUnlockLimiter.checkLimit(effectiveUserId);
  if (!rateLimitCheck.allowed) {
    throw new Error(
      `Too many unlock attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`,
    );
  }

  try {
    await secureStorage.unlock(password, effectiveUserId);

    // Get saved mnemonic and reinitialize
    const mnemonic = await getSavedMnemonic(password, effectiveUserId);
    if (mnemonic) {
      await initWallet(mnemonic, effectiveUserId);
      // Success - reset rate limit
      walletUnlockLimiter.reset(effectiveUserId);
    } else {
      throw new Error("No saved wallet found");
    }
  } catch (error) {
    // Failed attempt recorded by rate limiter
    throw error;
  }
};

// Check if wallet is locked
export const isWalletLocked = (): boolean => {
  return !secureStorage.isUnlocked() || !sdk;
};

// Check if storage is unlocked
export const isStorageUnlocked = (): boolean => {
  return secureStorage.isUnlocked();
};

// Reset lock timer
export const resetLockTimer = (): void => {
  secureStorage.resetLockTimer();
};

// Set lock timeout (in milliseconds)
export const setLockTimeout = (milliseconds: number): void => {
  secureStorage.setLockTimeout(milliseconds);
};

// Get current lock timeout
export const getLockTimeout = (): number => {
  return secureStorage.getLockTimeout();
};

// Get node info
export const getNodeInfo = async (): Promise<breezSdk.NodeState | null> => {
  if (!sdk) return null;

  try {
    const info = await sdk.getInfo();
    return info.nodeState;
  } catch (error) {
    sdkLogger.error("Failed to get node info:", error);
    return null;
  }
};

// Lightning Address / LNURL Operations
export const registerWebhook = async (webhookUrl: string): Promise<void> => {
  if (!sdk) throw new Error("SDK not initialized");
  sdkLogger.info("Registering webhook:", redactUrl(webhookUrl));
  await sdk.registerWebhook(webhookUrl);
  sdkLogger.info("Webhook registered successfully");
};

export const unregisterWebhook = async (): Promise<void> => {
  if (!sdk) throw new Error("SDK not initialized");
  sdkLogger.info("Unregistering webhook");
  await sdk.unregisterWebhook();
  sdkLogger.info("Webhook unregistered successfully");
};

export const signMessage = async (message: string): Promise<string> => {
  if (!sdk) throw new Error("SDK not initialized");
  sdkLogger.debug("Signing message");
  const result = await sdk.signMessage({ message });
  return result.signature;
};

// LNURL Payment Operations (for sending to Lightning addresses)
export const prepareLnurlPay = async (
  params: breezSdk.PrepareLnUrlPayRequest,
): Promise<breezSdk.PrepareLnUrlPayResponse> => {
  if (!sdk) throw new Error("SDK not initialized");
  return await sdk.prepareLnurlPay(params);
};

export const lnurlPay = async (
  params: breezSdk.LnUrlPayRequest,
): Promise<breezSdk.LnUrlPayResult> => {
  if (!sdk) throw new Error("SDK not initialized");
  await waitForOutgoingSlot();
  try {
    const result = await sdk.lnurlPay(params);
    const txId = result?.payment?.txId;
    if (typeof txId === "string" && /^[a-fA-F0-9]{64}$/.test(txId)) {
      sdkLogger.info("LnurlPay broadcast txId:", txId);
      trackPendingTx(txId, "liquid");
      trackOutgoingTx(txId, "liquid");
    } else if (txId) {
      sdkLogger.warn("LnurlPay returned non-txid identifier:", txId);
    }
    return result;
  } catch (error) {
    sdkLogger.error("LnurlPay failed:", error);
    const message =
      error instanceof Error ? error.message : String(error || "");
    throw new Error(mapTxError(message, "Payment failed"));
  }
};

// Lightning Address types
export interface LnAddressRegistrationResult {
  lnurl: string;
  lightningAddress?: string;
  bip353Address?: string;
  usernameModified?: boolean; // True if discriminator was added
  requestedUsername?: string; // Original username requested
  actualUsername?: string; // Actual username registered (with discriminator if added)
}

export class UsernameConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsernameConflictError";
  }
}

// Username formatting utilities (inspired by misty-breez)
export const formatUsername = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "") // Remove spaces: "Red Panda" → "redpanda"
    .replace(/[^a-z0-9_-]/g, ""); // Remove invalid chars
};

// No longer needed - using sequential numbers instead
// export const generateDiscriminator = (): string => {
//   return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
// };

// Helper to generate BOLT12 offer for Lightning Address
const generateLightningAddressOffer = async (
  username: string,
): Promise<string> => {
  if (!sdk) throw new Error("SDK not initialized");

  const prepareResponse = await prepareReceivePayment({
    paymentMethod: "bolt12Offer",
  });

  const receiveResponse = await receivePayment({
    prepareResponse,
    description: `${username}@breez.fun Lightning Address`,
  });

  return receiveResponse.destination;
};

// Recover existing Lightning Address from webhook
export const recoverLightningAddress = async (
  webhookUrl: string,
): Promise<LnAddressRegistrationResult | null> => {
  if (!sdk) throw new Error("SDK not initialized");

  lightningAddressLogger.info(
    "Attempting recovery with webhook:",
    redactUrl(webhookUrl),
  );

  try {
    // Get wallet info for pubkey
    const info = await getWalletInfo();
    if (!info?.walletInfo) throw new Error("Failed to get wallet info");
    const pubkey = info.walletInfo.pubkey;

    // Sign recovery message
    const time = Math.floor(Date.now() / 1000);
    const message = `${time}-${webhookUrl}`;
    const signature = await signMessage(message);

    // Try to recover from Breez service using the /recover endpoint
    // Add 30-second timeout like misty-breez
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(`https://breez.fun/lnurlpay/${pubkey}/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time,
          webhook_url: webhookUrl,
          signature,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      // Timeout, CORS, or network error - treat as "not found"
      if (fetchError.name === "AbortError") {
        lightningAddressLogger.info(
          "Recovery request timed out after 30 seconds, will register new address",
        );
      } else {
        lightningAddressLogger.info(
          "Recovery request failed (likely CORS), will register new address",
        );
      }
      return null;
    }

    if (!response.ok) {
      if (response.status === 404) {
        lightningAddressLogger.info("No existing registration found");
        return null;
      }
      throw new Error(`Recovery failed: ${response.status}`);
    }

    const result = await response.json();
    lightningAddressLogger.info("Recovery successful:", result);

    return {
      lnurl: result.lnurl,
      lightningAddress: result.lightning_address,
      bip353Address: result.bip353_address,
    };
  } catch (error) {
    lightningAddressLogger.error("Recovery failed:", error);
    return null;
  }
};

// Update Lightning Address username
export const updateLightningAddress = async (
  newUsername: string,
  webhookUrl: string,
): Promise<LnAddressRegistrationResult> => {
  if (!sdk) throw new Error("SDK not initialized");

  lightningAddressLogger.info("Updating to username:", newUsername);

  try {
    // Generate new BOLT12 offer
    const offer = await generateLightningAddressOffer(newUsername);

    // Register with new username (which updates existing registration)
    return await registerLightningAddress(newUsername, webhookUrl, offer);
  } catch (error) {
    lightningAddressLogger.error("Update failed:", error);
    throw error;
  }
};

// Unregister Lightning Address
export const unregisterLightningAddress = async (
  webhookUrl: string,
): Promise<void> => {
  if (!sdk) throw new Error("SDK not initialized");

  lightningAddressLogger.info("Unregistering...");

  try {
    // Get wallet info for pubkey
    const info = await getWalletInfo();
    if (!info?.walletInfo) throw new Error("Failed to get wallet info");
    const pubkey = info.walletInfo.pubkey;

    // Sign unregister message
    const time = Math.floor(Date.now() / 1000);
    const message = `${time}-${webhookUrl}`;
    const signature = await signMessage(message);

    // Unregister from Breez service
    const response = await fetch(`https://breez.fun/lnurlpay/${pubkey}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        time,
        webhook_url: webhookUrl,
        signature,
      }),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Unregister failed: ${response.status}`);
    }

    // Unregister webhook from SDK
    await unregisterWebhook();

    lightningAddressLogger.info("Unregistered successfully");
  } catch (error) {
    lightningAddressLogger.error("Unregister failed:", error);
    throw error;
  }
};

// Lightning Address Registration with Breez Service (single attempt - internal use)
const registerLightningAddressSingle = async (
  username: string,
  webhookUrl: string,
  offer?: string,
): Promise<LnAddressRegistrationResult> => {
  if (!sdk) throw new Error("SDK not initialized");

  lightningAddressLogger.info("Starting registration for username:", username);

  try {
    // 1. Get wallet info for pubkey
    const info = await getWalletInfo();
    if (!info?.walletInfo) throw new Error("Failed to get wallet info");
    const pubkey = info.walletInfo.pubkey;

    lightningAddressLogger.info("Wallet pubkey:", pubkey);

    // 2. Generate BOLT12 offer (or use provided one for updates)
    let bolt12Offer = offer;
    if (!bolt12Offer) {
      lightningAddressLogger.info("Generating BOLT12 offer...");
      bolt12Offer = await generateLightningAddressOffer(username);
      lightningAddressLogger.info(
        "BOLT12 offer generated:",
        summarizeOffer(bolt12Offer),
      );
    }

    // 3. Clean up any existing webhook before registering new one
    try {
      lightningAddressLogger.info("Unregistering any existing webhook...");
      await unregisterWebhook();
      lightningAddressLogger.info("Existing webhook unregistered");
    } catch (error) {
      // Ignore errors - webhook might not exist
      lightningAddressLogger.info(
        "No existing webhook to unregister (this is fine)",
      );
    }

    // 4. Register new webhook with Breez SDK
    lightningAddressLogger.info("Registering webhook with SDK...");
    await registerWebhook(webhookUrl);

    // 5. Sign registration message
    const time = Math.floor(Date.now() / 1000);
    const message = `${time}-${webhookUrl}-${username}-${bolt12Offer}`;
    lightningAddressLogger.info("Signing registration message...");
    const signature = await signMessage(message);

    // 6. Register with Breez LNURL service
    // Add 30-second timeout like misty-breez
    lightningAddressLogger.info("Registering with Breez LNURL service...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(`https://breez.fun/lnurlpay/${pubkey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time,
          webhook_url: webhookUrl,
          username,
          offer: bolt12Offer,
          signature,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        throw new Error("Registration request timed out after 30 seconds");
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text();

      // Check for username conflict (409 Conflict)
      if (response.status === 409) {
        throw new UsernameConflictError("Username is already taken");
      }

      // Log full error for debugging, throw generic message
      const requestId =
        response.headers.get("request-id") ||
        response.headers.get("x-request-id") ||
        response.headers.get("x-correlation-id") ||
        undefined;
      lightningAddressLogger.error("Breez registration failed", {
        status: response.status,
        responseBodyLength: errorText?.length || 0,
        requestId,
      });
      throw new Error(`Breez registration failed: ${response.status}`);
    }

    const result = await response.json();
    lightningAddressLogger.info("Registration successful:", result);

    return {
      lnurl: result.lnurl,
      lightningAddress: result.lightning_address,
      bip353Address: result.bip353_address,
    };
  } catch (error) {
    lightningAddressLogger.error("Registration failed:", error);
    throw error;
  }
};

// Lightning Address Registration with automatic retry on collision
export const registerLightningAddress = async (
  username: string,
  webhookUrl: string,
  offer?: string,
  maxRetries: number = 20,
): Promise<LnAddressRegistrationResult> => {
  if (!sdk) throw new Error("SDK not initialized");

  const requestedUsername = username;
  let currentUsername = username;
  let lastError: Error | null = null;
  const attemptedUsernames = new Set<string>();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // First attempt: try base username
      // Subsequent attempts: add a random suffix between 10 and 1000
      if (attempt === 0) {
        currentUsername = username;
      } else {
        let suffix = 10;
        let candidate = "";
        let tries = 0;
        do {
          suffix = 10 + Math.floor(Math.random() * 991);
          candidate = `${username}${suffix}`;
          tries += 1;
        } while (attemptedUsernames.has(candidate) && tries < 5);
        if (attemptedUsernames.has(candidate)) {
          const fallbackSuffix = `${attempt}-${Date.now() % 10000}`;
          candidate = `${username}${fallbackSuffix}`;
        }
        currentUsername = candidate;
      }

      lightningAddressLogger.info(
        `Registration attempt ${attempt + 1}/${maxRetries} with username: ${currentUsername}`,
      );
      attemptedUsernames.add(currentUsername);

      const result = await registerLightningAddressSingle(
        currentUsername,
        webhookUrl,
        offer,
      );

      // Add metadata about username modification
      return {
        ...result,
        usernameModified: currentUsername !== requestedUsername,
        requestedUsername: requestedUsername,
        actualUsername: currentUsername,
      };
    } catch (error) {
      if (error instanceof UsernameConflictError && attempt < maxRetries - 1) {
        lightningAddressLogger.warn(
          `Username conflict for: ${currentUsername}, trying next number...`,
        );

        // Progressive backoff to prevent DOS: 100ms, 200ms, 300ms, etc.
        // After 5 attempts, use longer backoff (500ms)
        const backoffMs = attempt < 5 ? (attempt + 1) * 100 : 500;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      lastError = error instanceof Error ? error : new Error(String(error));
      break;
    }
  }

  throw lastError || new Error("Registration failed after retries");
};

// Setup Lightning Address with automatic recovery
// Recovery only works if you restore the SAME seed (same pubkey)
// New seed = new Lightning address (with discriminator if username taken)
export const setupLightningAddress = async (
  username: string | null,
  webhookUrl: string,
  isRecover: boolean = false,
): Promise<LnAddressRegistrationResult> => {
  if (!sdk) throw new Error("SDK not initialized");

  lightningAddressLogger.info("Setup started", { username, isRecover });

  try {
    // Try recovery first if requested
    // This ONLY succeeds if the current pubkey already has a registration
    if (isRecover) {
      const recovered = await recoverLightningAddress(webhookUrl);
      if (recovered && recovered.lightningAddress) {
        lightningAddressLogger.info(
          "Recovered existing address for this seed:",
          recovered.lightningAddress,
        );

        // Same seed restored - just update the webhook URL (no username change)
        const recoveredUsername = recovered.lightningAddress.split("@")[0];

        // Generate new BOLT12 offer
        const offer = await generateLightningAddressOffer(recoveredUsername);

        // Re-register to update webhook URL (same pubkey, same username)
        const result = await registerLightningAddress(
          recoveredUsername,
          webhookUrl,
          offer,
        );
        lightningAddressLogger.info(
          "Webhook updated for recovered address:",
          result.lightningAddress,
        );
        return result;
      }
      lightningAddressLogger.info("No existing registration for this seed");
    }

    // New seed - register new address
    // If username not provided, generate from pubkey
    let effectiveUsername = username;
    if (!effectiveUsername) {
      const info = await getWalletInfo();
      if (!info?.walletInfo) throw new Error("Failed to get wallet info");
      effectiveUsername = info.walletInfo.pubkey.substring(0, 16);
    }

    // Register with automatic discriminator if username taken
    lightningAddressLogger.info(
      "Registering new address for new seed:",
      effectiveUsername,
    );
    return await registerLightningAddress(effectiveUsername, webhookUrl);
  } catch (error) {
    lightningAddressLogger.error("Setup failed:", error);
    throw error;
  }
};

// Aliases for compatibility
export const getMnemonic = getSavedMnemonic;
export const disconnectWallet = disconnect;

// Export for testing
export const _testExports = {
  getSdk: () => sdk,
  isWasmInit: () => wasmInitialized,
  getListeners: () => eventListeners,
};
