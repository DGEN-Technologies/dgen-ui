import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";

const DEFAULT_BACKEND_URL = "http://localhost:3119";
const VALID_NETWORKS = new Set([
  "bitcoin",
  "liquid",
  "testnet",
  "liquidtestnet",
]);

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
) {
  try {
    if (!isAllowedEsploraPath(path)) {
      throw error(400, "Invalid esplora path");
    }
    const requestUrl = new URL(request.url);
    const url = buildBackendUrl(path, requestUrl.search);

    const headers = stripSensitiveRequestHeaders(new Headers(request.headers));

    const auth = request.headers.get("authorization");
    if (!auth) {
      const token = cookies.get("token");
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
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

export async function GET({ params, request, cookies }) {
  return handleRequest("GET", params.path, request, cookies);
}

export async function POST({ params, request, cookies }) {
  return handleRequest("POST", params.path, request, cookies);
}

export async function PUT({ params, request, cookies }) {
  return handleRequest("PUT", params.path, request, cookies);
}

export async function DELETE({ params, request, cookies }) {
  return handleRequest("DELETE", params.path, request, cookies);
}

export async function PATCH({ params, request, cookies }) {
  return handleRequest("PATCH", params.path, request, cookies);
}
