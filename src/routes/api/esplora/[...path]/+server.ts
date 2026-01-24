import { error } from "@sveltejs/kit";
import { createHash } from "crypto";
import { env } from "$env/dynamic/public";

const DEFAULT_BACKEND_URL = "http://localhost:3119";
const VALID_NETWORKS = new Set([
  "bitcoin",
  "liquid",
  "testnet",
  "liquidtestnet",
]);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const MAX_RATE_LIMIT_KEYS = 5000;
const rateLimitBuckets = new Map<
  string,
  { count: number; resetAt: number; lastSeen: number }
>();

const BASE_PATH_PATTERNS = [
  /^tx$/,
  /^tx\/[^/]+(?:\/(status|hex|raw))?$/,
  /^address\/[^/]+\/(?:utxo|txs|txs\/chain|txs\/mempool)$/,
  /^scripthash\/[^/]+\/(?:utxo|txs|txs\/chain|txs\/mempool)$/,
  /^blocks\/tip\/(?:height|hash)$/,
  /^block\/[^/]+\/header$/,
  /^block-height\/[^/]+$/,
  /^fee-estimates$/,
  /^stats$/,
];

const AUTH_REQUIRED_PATTERNS = [/^stats$/];

const isAllowedEsploraPath = (path: string): boolean => {
  if (!path) return false;
  const normalized = path.replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("//")) {
    return false;
  }
  const [first, ...rest] = normalized.split("/");
  const candidate = VALID_NETWORKS.has(first) ? rest.join("/") : normalized;
  return BASE_PATH_PATTERNS.some((pattern) => pattern.test(candidate));
};

const requiresAuth = (path: string): boolean => {
  const normalized = path.replace(/^\/+/, "");
  const [first, ...rest] = normalized.split("/");
  const candidate = VALID_NETWORKS.has(first) ? rest.join("/") : normalized;
  return AUTH_REQUIRED_PATTERNS.some((pattern) => pattern.test(candidate));
};

const pruneRateLimits = (now: number): void => {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (now > bucket.resetAt) {
      rateLimitBuckets.delete(key);
    }
  }
  if (rateLimitBuckets.size <= MAX_RATE_LIMIT_KEYS) return;
  const oldest = Array.from(rateLimitBuckets.entries()).sort(
    (a, b) => a[1].lastSeen - b[1].lastSeen,
  );
  const overflow = rateLimitBuckets.size - MAX_RATE_LIMIT_KEYS;
  for (let i = 0; i < overflow; i += 1) {
    const key = oldest[i]?.[0];
    if (key) rateLimitBuckets.delete(key);
  }
};

const checkRateLimit = (
  key: string,
): { allowed: boolean; retryAfter: number } => {
  const now = Date.now();
  pruneRateLimits(now);
  const existing = rateLimitBuckets.get(key);
  if (!existing || now > existing.resetAt) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
      lastSeen: now,
    });
    return { allowed: true, retryAfter: 0 };
  }
  existing.count += 1;
  existing.lastSeen = now;
  if (existing.count > RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfter: 0 };
};

const hashToken = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const getRateLimitKey = (
  clientAddress: string | undefined,
  request: Request,
  cookies: { get: (name: string) => string | undefined },
): string => {
  if (clientAddress) return `ip:${clientAddress}`;
  const auth = request.headers.get("authorization");
  if (auth) return `auth:${hashToken(auth)}`;
  const token = cookies.get("token");
  if (token) return `cookie:${hashToken(token)}`;
  return "ip:unknown";
};

const stripSensitiveRequestHeaders = (headers: Headers): Headers => {
  const sanitized = new Headers(headers);
  const blockedHeaders = [
    "cookie",
    "host",
    "forwarded",
    "x-real-ip",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-forwarded-port",
    "cf-connecting-ip",
    "cf-ipcountry",
    "cf-ray",
    "cf-visitor",
  ];
  for (const name of blockedHeaders) {
    sanitized.delete(name);
  }
  for (const [name] of sanitized.entries()) {
    if (name.toLowerCase().startsWith("x-forwarded-")) {
      sanitized.delete(name);
    }
  }
  return sanitized;
};

// Allowlist for response headers to prevent leaking internal backend info
const ALLOWED_RESPONSE_HEADERS = new Set([
  "content-type",
  "content-length",
  "content-encoding",
  "cache-control",
  "etag",
  "last-modified",
  "vary",
  "x-esplora-rate-limited", // Our rate limit signal
]);

const filterResponseHeaders = (headers: Headers): Headers => {
  const filtered = new Headers();
  for (const [name, value] of headers.entries()) {
    if (ALLOWED_RESPONSE_HEADERS.has(name.toLowerCase())) {
      filtered.set(name, value);
    }
  }
  return filtered;
};

const buildBackendUrl = (path: string, query: string): string => {
  const base = env.PUBLIC_DGEN_URL || DEFAULT_BACKEND_URL;
  return `${base.replace(/\/$/, "")}/api/esplora/${path}${query}`;
};

async function handleRequest(
  method: string,
  path: string,
  request: Request,
  cookies: { get: (name: string) => string | undefined },
  clientAddress?: string,
) {
  try {
    if (!isAllowedEsploraPath(path)) {
      throw error(400, "Invalid esplora path");
    }
    const rateKey = getRateLimitKey(clientAddress, request, cookies);
    const rateLimit = checkRateLimit(rateKey);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          code: "ESPLORA_RATE_LIMITED",
          message: "Too many requests",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter),
          },
        },
      );
    }
    const requestUrl = new URL(request.url);
    const url = buildBackendUrl(path, requestUrl.search);

    const headers = stripSensitiveRequestHeaders(new Headers(request.headers));

    const auth = request.headers.get("authorization");
    if (!auth) {
      if (requiresAuth(path)) {
        const token = cookies.get("token");
        if (token) {
          headers.set("authorization", `Bearer ${token}`);
        }
      }
    }

    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : await request.arrayBuffer();

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    return new Response(response.body, {
      status: response.status,
      headers: filterResponseHeaders(response.headers),
    });
  } catch (err) {
    console.error(`[Esplora Proxy] ${method} ${path} failed:`, err);
    throw error(502, "Esplora proxy request failed");
  }
}

export async function GET({ params, request, cookies, getClientAddress }) {
  return handleRequest(
    "GET",
    params.path,
    request,
    cookies,
    getClientAddress?.(),
  );
}

export async function POST({ params, request, cookies, getClientAddress }) {
  return handleRequest(
    "POST",
    params.path,
    request,
    cookies,
    getClientAddress?.(),
  );
}

export async function PUT({ params, request, cookies, getClientAddress }) {
  return handleRequest(
    "PUT",
    params.path,
    request,
    cookies,
    getClientAddress?.(),
  );
}

export async function DELETE({ params, request, cookies, getClientAddress }) {
  return handleRequest(
    "DELETE",
    params.path,
    request,
    cookies,
    getClientAddress?.(),
  );
}

export async function PATCH({ params, request, cookies, getClientAddress }) {
  return handleRequest(
    "PATCH",
    params.path,
    request,
    cookies,
    getClientAddress?.(),
  );
}
