import { browser } from "$app/environment";
import { PUBLIC_DGEN_URL } from "$env/static/public";

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

// Single-flight tracking to prevent duplicate in-flight requests
const inFlightRequests = new Map<string, Promise<any>>();

// Simple memory cache for client-side
const memoryCache = new Map<string, { data: any; expires: number }>();
const MAX_CACHE_ENTRIES = 500;

const CACHE_TTL = {
  TX_STATUS: 10000, // 10 seconds
  UTXO: 5000, // 5 seconds
  TIP_HEIGHT: 3000, // 3 seconds
  TX_CONFIRMED: 60000, // 1 minute for confirmed txs
};

function getFromCache<T>(key: string): T | null {
  const cached = memoryCache.get(key);
  if (cached && Date.now() < cached.expires) {
    memoryCache.delete(key);
    memoryCache.set(key, cached);
    return cached.data as T;
  }
  memoryCache.delete(key);
  return null;
}

function pruneCache(): void {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.expires <= now) {
      memoryCache.delete(key);
    }
  }

  while (memoryCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
}

function setCache(key: string, data: any, ttlMs: number): void {
  pruneCache();
  memoryCache.set(key, {
    data,
    expires: Date.now() + ttlMs,
  });
  pruneCache();
}

function getBaseUrl(): string {
  // In browser, use relative URL for same-origin requests
  // Or use PUBLIC_DGEN_URL if available
  if (browser && PUBLIC_DGEN_URL) {
    return PUBLIC_DGEN_URL;
  }
  return "";
}

type FetchResult<T> = T | [T, number];

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
    return existing;
  }

  // Create and track the request
  const promise = fetchFn()
    .then((result) => {
      const [data, effectiveTtl] = Array.isArray(result)
        ? result
        : [result, ttlMs];
      setCache(cacheKey, data, effectiveTtl);
      return data;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, promise);
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
    throw new Error(`Esplora API error: ${response.status} - ${errorBody}`);
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
    throw new Error(`Esplora API error: ${response.status} - ${errorBody}`);
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
  const cacheKey = `tx:status:${network}:${txid}`;

  return fetchWithSingleFlight(
    cacheKey,
    async () => {
      const status = await apiRequest<TxStatus>(
        `/tx/${encodeURIComponent(txid)}/status?network=${encodeURIComponent(network)}`,
      );
      const ttl = status.confirmed
        ? CACHE_TTL.TX_CONFIRMED
        : CACHE_TTL.TX_STATUS;
      return [status, ttl];
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
  const cacheKey = `tx:full:${network}:${txid}`;

  return fetchWithSingleFlight(
    cacheKey,
    () =>
      apiRequest<any>(
        `/tx/${encodeURIComponent(txid)}?network=${encodeURIComponent(network)}`,
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
  const cacheKey = `utxo:${network}:${address}`;

  return fetchWithSingleFlight(
    cacheKey,
    () =>
      apiRequest<Utxo[]>(
        `/address/${encodeURIComponent(address)}/utxo?network=${encodeURIComponent(network)}`,
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
  const cacheKey = `tip:${network}`;

  return fetchWithSingleFlight(
    cacheKey,
    async () => {
      const result = await apiRequestText(
        `/blocks/tip/height?network=${encodeURIComponent(network)}`,
      );
      const height = Number.parseInt(result, 10);
      if (!Number.isFinite(height)) {
        throw new Error(`Invalid tip height response: ${result}`);
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
  const cacheKey = lastSeenTxid
    ? `addr_txs:${network}:${address}:${lastSeenTxid}`
    : `addr_txs:${network}:${address}`;

  let endpoint = `/address/${encodeURIComponent(address)}/txs?network=${encodeURIComponent(
    network,
  )}`;
  if (lastSeenTxid) {
    endpoint += `&lastSeenTxid=${encodeURIComponent(lastSeenTxid)}`;
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
  const result = await apiRequest<{ txid: string }>(`/tx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txHex, network }),
  });

  return result.txid;
}

/**
 * Get service stats for monitoring
 */
export async function getStats(): Promise<{
  backoffUntil: number;
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
