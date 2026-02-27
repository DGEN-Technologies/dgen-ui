import { error, json } from "@sveltejs/kit";
import { isAllowedLnurlHost } from "$lib/server/lnurlSecurity";

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

  let lnurlpUrl: URL;
  try {
    lnurlpUrl = new URL(
      `https://${domain}/.well-known/lnurlp/${encodeURIComponent(
        name.toLowerCase(),
      )}`,
    );
  } catch {
    throw error(400, "Invalid lightning address domain");
  }

  if (!(await isAllowedLnurlHost(lnurlpUrl, fetch))) {
    throw error(400, "Invalid lightning address domain");
  }

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

  const minSendable = Number(body.minSendable);
  const maxSendable = Number(body.maxSendable);
  const commentAllowedRaw = Number(body.commentAllowed ?? 0);

  const isValidNonNegativeInt = (value: number) =>
    Number.isFinite(value) && Number.isInteger(value) && value >= 0;

  if (
    !isValidNonNegativeInt(minSendable) ||
    !isValidNonNegativeInt(maxSendable)
  ) {
    throw error(400, "Invalid lightning address limits");
  }
  if (minSendable > maxSendable) {
    throw error(400, "Invalid lightning address limits");
  }
  const commentAllowed = isValidNonNegativeInt(commentAllowedRaw)
    ? Math.min(commentAllowedRaw, 500)
    : 0;

  const proxyUrl = new URL("/api/lnurl/callback", url.origin);
  proxyUrl.searchParams.set("url", callbackUrl);

  return json({
    callback: proxyUrl.toString(),
    minSendable,
    maxSendable,
    metadataStr: body.metadata ?? body.metadataStr ?? "",
    commentAllowed,
    domain,
    allowsNostr: Boolean(body.allowsNostr),
    nostrPubkey: body.nostrPubkey ?? undefined,
    lnAddress: address,
  });
};
