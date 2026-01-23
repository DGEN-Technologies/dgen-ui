import { browser } from "$app/environment";
import { env } from "$env/dynamic/public";
import { bech32, bech32m } from "bech32";
import { sha256 } from "@noble/hashes/sha256";
import { base58check } from "@scure/base";

export type Network = "bitcoin" | "liquid" | "testnet" | "liquidtestnet";

interface TxStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

interface Utxo {
  txid: string;
  vout: number;
  status: TxStatus;
  value: number;
}

const TXID_REGEX = /^[a-fA-F0-9]{64}$/;
const HEX_REGEX = /^[a-fA-F0-9]+$/;
// Prevent oversized tx hex submissions; 2MB hex ~= 1MB raw tx.
const MAX_TX_HEX_LENGTH = 2 * 1024 * 1024;
const VALID_NETWORKS = new Set<Network>([
  "bitcoin",
  "liquid",
  "testnet",
  "liquidtestnet",
]);
const MAX_ADDRESS_LENGTH = 120;
const base58Address = /^[1-9A-HJ-NP-Za-km-z]{25,90}$/;
const bech32Address = /^(bc1|tb1|bcrt1|lq1|tlq1|ex1|tex1)[0-9a-z]{6,}$/i;
const bech32Prefixes = new Set(["bc", "tb", "bcrt", "lq", "tlq", "ex", "tex"]);
const base58Check = base58check(sha256);

function validateTxid(txid: string): void {
  if (!TXID_REGEX.test(txid)) {
    throw new Error("Invalid txid format");
  }
}

function validateTxHex(txHex: string): void {
  if (
    !txHex ||
    txHex.length > MAX_TX_HEX_LENGTH ||
    txHex.length % 2 !== 0 ||
    !HEX_REGEX.test(txHex)
  ) {
    throw new Error("Invalid transaction hex: must be even-length hex string");
  }
}

function validateNetwork(network: string): asserts network is Network {
  if (!VALID_NETWORKS.has(network as Network)) {
    throw new Error("Invalid network");
  }
}

function isValidBase58Address(address: string): boolean {
  if (!base58Address.test(address)) return false;
  try {
    base58Check.decode(address);
    return true;
  } catch {
    return false;
  }
}

function isValidBech32Address(address: string): boolean {
  if (!bech32Address.test(address)) return false;
  const normalized = address.toLowerCase();
  const prefix = normalized.split("1")[0];
  if (!bech32Prefixes.has(prefix)) return false;
  try {
    bech32.decode(normalized, 1023);
    return true;
  } catch {}
  try {
    bech32m.decode(normalized, 1023);
    return true;
  } catch {}
  return false;
}

function isValidAddress(address: string): boolean {
  if (!address) return false;
  if (address.length < 14 || address.length > MAX_ADDRESS_LENGTH) return false;
  if (!/^[a-zA-Z0-9]+$/.test(address)) return false;
  return isValidBase58Address(address) || isValidBech32Address(address);
}

function validateAddress(address: string): void {
  if (!isValidAddress(address)) {
    throw new Error("Invalid address format");
  }
}

// Single-flight tracking to prevent duplicate in-flight requests
const inFlightRequests = new Map<
  string,
  { promise: Promise<any>; startedAt: number }
>();
// Cap concurrent in-flight requests to avoid unbounded memory growth.
const MAX_INFLIGHT_ENTRIES = 200;
// Evict entries older than 2 minutes to avoid hanging promises.
const MAX_INFLIGHT_AGE_MS = 2 * 60 * 1000;

// Simple memory cache for client-side
const memoryCache = new Map<string, { data: any; expires: number }>();
// Limit cache size to keep memory bounded for long sessions.
const MAX_CACHE_ENTRIES = 500;

// Cache TTLs (ms): shorter for volatile endpoints, longer for confirmed data.
const CACHE_TTL = {
  TX_STATUS: 10000, // 10 seconds; pending tx status can change quickly
  UTXO: 5000, // 5 seconds; UTXO set is volatile with mempool updates
  TIP_HEIGHT: 3000, // 3 seconds; keep tip height responsive without spamming
  TX_CONFIRMED: 60000, // 1 minute; confirmed txs are stable, reduce calls
};

// Validation helpers are defined above.
function getFromCache<T>(key: string): T | null {
  if (memoryCache.size > MAX_CACHE_ENTRIES) {
    pruneCache();
  }
  const cached = memoryCache.get(key);
  if (cached && Date.now() < cached.expires) {
    memoryCache.delete(key);
    memoryCache.set(key, cached);
    if (typeof structuredClone === "function") {
      return structuredClone(cached.data) as T;
    }
    return JSON.parse(JSON.stringify(cached.data)) as T;
  }
  memoryCache.delete(key);
  return null;
}

function pruneInFlight(): void {
  const now = Date.now();
  for (const [key, value] of inFlightRequests.entries()) {
    if (now - value.startedAt > MAX_INFLIGHT_AGE_MS) {
      inFlightRequests.delete(key);
    }
  }

  if (inFlightRequests.size > MAX_INFLIGHT_ENTRIES) {
    console.warn(
      `[EsploraClient] In-flight map size ${inFlightRequests.size} exceeds ${MAX_INFLIGHT_ENTRIES}`,
    );
    while (inFlightRequests.size > MAX_INFLIGHT_ENTRIES) {
      const oldestKey = inFlightRequests.keys().next().value;
      if (!oldestKey) break;
      inFlightRequests.delete(oldestKey);
    }
  }
}

function pruneCache(): void {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.expires <= now) {
      memoryCache.delete(key);
    }
  }

  if (memoryCache.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(memoryCache.entries()).map(([key, value]) => ({
      key,
      expires: value.expires,
    }));
    entries.sort((a, b) => a.expires - b.expires);
    for (const entry of entries) {
      if (memoryCache.size <= MAX_CACHE_ENTRIES) break;
      memoryCache.delete(entry.key);
    }
  }
}

function setCache(key: string, data: any, ttlMs: number): void {
  pruneCache();
  memoryCache.set(key, {
    data,
    expires: Date.now() + ttlMs,
  });
}

function getBaseUrl(): string {
  if (!browser) {
    throw new Error("EsploraClient is browser-only");
  }

  // In browser, use relative URL for same-origin requests
  // Or use PUBLIC_DGEN_URL if available
  if (env.PUBLIC_DGEN_URL) {
    return env.PUBLIC_DGEN_URL;
  }
  return "";
}

type CacheResult<T> = {
  data: T;
  ttl?: number;
  __cache: true;
};

type FetchResult<T> = T | CacheResult<T>;

async function fetchWithSingleFlight<T>(
  cacheKey: string,
  fetchFn: () => Promise<FetchResult<T>>,
  ttlMs: number,
): Promise<T> {
  // Check cache first
  const cached = getFromCache<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Check if request is already in flight
  const existing = inFlightRequests.get(cacheKey);
  if (existing) {
    if (Date.now() - existing.startedAt > MAX_INFLIGHT_AGE_MS) {
      inFlightRequests.delete(cacheKey);
    } else {
      return existing.promise;
    }
  }

  // Create and track the request
  const promise = fetchFn()
    .then((result) => {
      if (result && typeof result === "object" && "__cache" in result) {
        const cacheResult = result as CacheResult<T>;
        const effectiveTtl = cacheResult.ttl ?? ttlMs;
        setCache(cacheKey, cacheResult.data, effectiveTtl);
        return cacheResult.data;
      }
      setCache(cacheKey, result, ttlMs);
      return result;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  pruneInFlight();
  inFlightRequests.set(cacheKey, { promise, startedAt: Date.now() });
  return promise;
}

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/esplora${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (import.meta.env.DEV) {
      console.warn("[EsploraClient] API error:", {
        status: response.status,
        body: errorBody,
      });
    }
    throw new Error("Esplora API request failed");
  }

  return response.json();
}

async function apiRequestText(
  endpoint: string,
  options?: RequestInit,
): Promise<string> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/esplora${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "text/plain",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (import.meta.env.DEV) {
      console.warn("[EsploraClient] API error:", {
        status: response.status,
        body: errorBody,
      });
    }
    throw new Error("Esplora API request failed");
  }

  return response.text();
}

/**
 * Get transaction status by txid
 */
export async function getTxStatus(
  txid: string,
  network: Network = "liquid",
): Promise<TxStatus> {
  const normalizedTxid = txid.trim();
  validateTxid(normalizedTxid);
  validateNetwork(network);
  const cacheKey = `tx:status:${network}:${normalizedTxid}`;

  return fetchWithSingleFlight(
    cacheKey,
    async () => {
      const status = await apiRequest<TxStatus>(
        `/tx/${encodeURIComponent(normalizedTxid)}/status?network=${encodeURIComponent(network)}`,
      );
      const ttl = status.confirmed
        ? CACHE_TTL.TX_CONFIRMED
        : CACHE_TTL.TX_STATUS;
      return { data: status, ttl, __cache: true };
    },
    CACHE_TTL.TX_STATUS,
  );
}

/**
 * Get full transaction details
 */
export async function getTx(
  txid: string,
  network: Network = "liquid",
): Promise<any> {
  const normalizedTxid = txid.trim();
  validateTxid(normalizedTxid);
  validateNetwork(network);
  const cacheKey = `tx:full:${network}:${normalizedTxid}`;

  return fetchWithSingleFlight(
    cacheKey,
    () =>
      apiRequest<any>(
        `/tx/${encodeURIComponent(normalizedTxid)}?network=${encodeURIComponent(network)}`,
      ),
    CACHE_TTL.TX_STATUS,
  );
}

/**
 * Get UTXOs for an address
 */
export async function getAddressUtxos(
  address: string,
  network: Network = "liquid",
): Promise<Utxo[]> {
  const normalizedAddress = address.trim();
  validateAddress(normalizedAddress);
  validateNetwork(network);
  const cacheKey = `utxo:${network}:${normalizedAddress}`;

  return fetchWithSingleFlight(
    cacheKey,
    () =>
      apiRequest<Utxo[]>(
        `/address/${encodeURIComponent(normalizedAddress)}/utxo?network=${encodeURIComponent(network)}`,
      ),
    CACHE_TTL.UTXO,
  );
}

/**
 * Get current block tip height
 */
export async function getTipHeight(
  network: Network = "liquid",
): Promise<number> {
  validateNetwork(network);
  const cacheKey = `tip:${network}`;

  return fetchWithSingleFlight(
    cacheKey,
    async () => {
      const result = await apiRequestText(
        `/blocks/tip/height?network=${encodeURIComponent(network)}`,
      );
      const height = Number.parseInt(result, 10);
      if (!Number.isFinite(height)) {
        if (import.meta.env.DEV) {
          console.warn("[EsploraClient] Invalid tip height response:", result);
        }
        throw new Error("Invalid tip height response");
      }
      return height;
    },
    CACHE_TTL.TIP_HEIGHT,
  );
}

/**
 * Get current block tip hash
 */
export async function getTipHash(network: Network = "liquid"): Promise<string> {
  validateNetwork(network);
  const cacheKey = `tiphash:${network}`;

  return fetchWithSingleFlight(
    cacheKey,
    () =>
      apiRequestText(`/blocks/tip/hash?network=${encodeURIComponent(network)}`),
    CACHE_TTL.TIP_HEIGHT,
  );
}

/**
 * Get address transaction history
 */
export async function getAddressTxs(
  address: string,
  network: Network = "liquid",
  lastSeenTxid?: string,
): Promise<any[]> {
  const normalizedAddress = address.trim();
  validateAddress(normalizedAddress);
  validateNetwork(network);
  const normalizedLastSeen = lastSeenTxid?.trim();
  if (normalizedLastSeen) {
    validateTxid(normalizedLastSeen);
  }
  const cacheKey = normalizedLastSeen
    ? `addr_txs:${network}:${normalizedAddress}:${normalizedLastSeen}`
    : `addr_txs:${network}:${normalizedAddress}`;

  let endpoint = `/address/${encodeURIComponent(normalizedAddress)}/txs?network=${encodeURIComponent(
    network,
  )}`;
  if (normalizedLastSeen) {
    endpoint += `&lastSeenTxid=${encodeURIComponent(normalizedLastSeen)}`;
  }

  return fetchWithSingleFlight(
    cacheKey,
    () => apiRequest<any[]>(endpoint),
    CACHE_TTL.TX_STATUS,
  );
}

/**
 * Get fee estimates
 */
export async function getFeeEstimates(
  network: Network = "bitcoin",
): Promise<Record<string, number>> {
  validateNetwork(network);
  const cacheKey = `fees:${network}`;

  return fetchWithSingleFlight(
    cacheKey,
    () =>
      apiRequest<Record<string, number>>(
        `/fee-estimates?network=${encodeURIComponent(network)}`,
      ),
    CACHE_TTL.TIP_HEIGHT,
  );
}

/**
 * Broadcast a raw transaction
 */
export async function broadcastTx(
  txHex: string,
  network: Network = "liquid",
): Promise<string> {
  const normalizedTxHex = txHex.trim();
  validateTxHex(normalizedTxHex);
  validateNetwork(network);
  const result = await apiRequest<{ txid: string }>(`/tx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txHex: normalizedTxHex, network }),
  });

  return result.txid;
}

/**
 * Get service stats for monitoring
 */
export async function getStats(): Promise<{
  backoffSecondsRemaining: number;
  consecutiveErrors: number;
  inFlightCount: number;
}> {
  return apiRequest(`/stats`);
}

/**
 * Clear local cache
 */
export function clearCache(): void {
  memoryCache.clear();
}

/**
 * Get local cache stats
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: memoryCache.size,
    keys: Array.from(memoryCache.keys()),
  };
}
