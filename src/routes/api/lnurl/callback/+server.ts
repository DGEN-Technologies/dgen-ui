import { error } from "@sveltejs/kit";
import { isAllowedLnurlHost } from "$lib/lnurlSecurity";

const isAbortError = (err: unknown): boolean => {
  return (
    !!err &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name?: string }).name === "AbortError"
  );
};

const fetchWithTimeout = async (
  fetchFn: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchWithRedirectValidation = async (
  fetchFn: typeof fetch,
  startUrl: URL,
  timeoutMs: number,
  maxRedirects = 3,
): Promise<Response> => {
  let currentUrl = startUrl;
  for (let i = 0; i <= maxRedirects; i += 1) {
    const response = await fetchWithTimeout(
      fetchFn,
      currentUrl.toString(),
      {
        headers: { accept: "application/json" },
        redirect: "manual",
      },
      timeoutMs,
    );

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect missing location header");
      }
      const nextUrl = new URL(location, currentUrl);
      if (!(await isAllowedLnurlHost(nextUrl, fetchFn))) {
        throw new Error("Redirected LNURL callback URL not allowed");
      }
      currentUrl = nextUrl;
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects");
};

export const GET = async ({ url, fetch }) => {
  const target = url.searchParams.get("url");
  if (!target) {
    throw error(400, "Missing LNURL callback URL");
  }

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(target);
  } catch {
    throw error(400, "Invalid LNURL callback URL");
  }

  if (!(await isAllowedLnurlHost(callbackUrl, fetch))) {
    throw error(400, "Unsupported LNURL callback URL");
  }

  url.searchParams.forEach((value, key) => {
    if (key === "url") return;
    callbackUrl.searchParams.set(key, value);
  });

  let response: Response;
  try {
    response = await fetchWithRedirectValidation(fetch, callbackUrl, 8000);
  } catch (err) {
    if (isAbortError(err)) {
      throw error(504, "LNURL callback timed out");
    }
    throw error(502, "LNURL callback request failed");
  }

  if (!response.ok) {
    const detail = await response.text();
    console.warn("[LNURL] Callback rejected", {
      status: response.status,
      detail: detail?.slice(0, 200),
    });
    return new Response(
      JSON.stringify({ status: "ERROR", reason: "LNURL callback failed" }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        reason: "LNURL callback returned non-JSON response",
      }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }

  let bodyText = "";
  try {
    bodyText = await response.text();
    const parsed = JSON.parse(bodyText);
    return new Response(JSON.stringify(parsed), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        reason: "LNURL callback returned invalid JSON",
      }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }
};
