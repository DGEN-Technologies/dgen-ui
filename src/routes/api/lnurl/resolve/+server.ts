import { error, json } from "@sveltejs/kit";

const ADDRESS_RE = /^([a-z0-9._-]+)@([a-z0-9.-]+)$/i;

export const GET = async ({ url, fetch }) => {
  const address = url.searchParams.get("address")?.trim() || "";
  const match = ADDRESS_RE.exec(address);
  if (!match) {
    throw error(400, "Invalid lightning address");
  }

  const [, name, domain] = match;
  if (!domain || domain.includes("..")) {
    throw error(400, "Invalid lightning address domain");
  }

  const lnurlpUrl = `https://${domain}/.well-known/lnurlp/${encodeURIComponent(
    name.toLowerCase(),
  )}`;

  let response: Response;
  try {
    response = await fetch(lnurlpUrl, {
      headers: { accept: "application/json" },
    });
  } catch (err) {
    throw error(502, "Failed to reach lightning address host");
  }

  if (!response.ok) {
    throw error(
      response.status,
      `Lightning address lookup failed (${response.status})`,
    );
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    throw error(502, "Invalid lightning address response");
  }

  if (!body || body.tag !== "payRequest") {
    throw error(400, "Lightning address is not a payRequest");
  }

  const callbackUrl = String(body.callback || "");
  if (!callbackUrl) {
    throw error(400, "Lightning address callback missing");
  }

  const proxyUrl = new URL("/api/lnurl/callback", url.origin);
  proxyUrl.searchParams.set("url", callbackUrl);

  return json({
    callback: proxyUrl.toString(),
    minSendable: Number(body.minSendable),
    maxSendable: Number(body.maxSendable),
    metadataStr: body.metadata ?? body.metadataStr ?? "",
    commentAllowed: Number(body.commentAllowed ?? 0),
    domain,
    allowsNostr: Boolean(body.allowsNostr),
    nostrPubkey: body.nostrPubkey ?? undefined,
    lnAddress: address,
  });
};
