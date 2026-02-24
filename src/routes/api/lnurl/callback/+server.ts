import { error } from "@sveltejs/kit";

const isAllowedCallback = (target: URL): boolean => {
  if (target.protocol !== "https:") return false;
  if (!target.hostname) return false;
  return true;
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

  if (!isAllowedCallback(callbackUrl)) {
    throw error(400, "Unsupported LNURL callback URL");
  }

  url.searchParams.forEach((value, key) => {
    if (key === "url") return;
    callbackUrl.searchParams.set(key, value);
  });

  let response: Response;
  try {
    response = await fetch(callbackUrl.toString(), {
      headers: { accept: "application/json" },
    });
  } catch {
    throw error(502, "LNURL callback request failed");
  }

  const contentType = response.headers.get("content-type") || "application/json";
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
};
