import { error, json } from "@sveltejs/kit";
import { bech32 } from "bech32";
import { isAllowedLnurlHost } from "$lib/server/lnurlSecurity";

const ADDRESS_RE = /^([a-z0-9._-]+)@([a-z0-9.-]+)$/i;
const COINOS_HOST = "coinos.io";

export const GET = async ({ url, fetch }) => {
  let address = url.searchParams.get("address")?.trim() || "";
  const lowerAddress = address.toLowerCase();
  if (lowerAddress.startsWith("lightning:")) {
    address = address.slice("lightning:".length).trim();
  }

  let lnurlpUrl: URL;
  let domain = "";
  let lnAddress: string | undefined;
  let urlInput: URL | null = null;

  if (address.toLowerCase().startsWith("lnurl")) {
    let lnurlText = address.toLowerCase();
    if (
      lnurlText.startsWith("lnurlp://") ||
      lnurlText.startsWith("lnurlw://") ||
      lnurlText.startsWith("lnurlc://")
    ) {
      lnurlText = `https://${lnurlText.slice("lnurl".length + 3)}`;
    } else if (lnurlText.startsWith("lnurl1")) {
      try {
        const decoded = bech32.decode(lnurlText, 20000);
        if (decoded.prefix !== "lnurl") {
          throw error(400, "Invalid LNURL");
        }
        const bytes = bech32.fromWords(decoded.words);
        lnurlText = Buffer.from(bytes).toString();
      } catch {
        throw error(400, "Invalid LNURL");
      }
    }

    try {
      lnurlpUrl = new URL(lnurlText);
      domain = lnurlpUrl.hostname;
    } catch {
      throw error(400, "Invalid LNURL");
    }
  } else {
    const match = ADDRESS_RE.exec(address);
    if (match) {
      const [, name, addrDomain] = match;
      if (!addrDomain || addrDomain.includes("..")) {
        throw error(400, "Invalid lightning address domain");
      }

      domain = addrDomain;
      lnAddress = address;
      try {
        lnurlpUrl = new URL(
          `https://${addrDomain}/.well-known/lnurlp/${encodeURIComponent(
            name.toLowerCase(),
          )}`,
        );
      } catch {
        throw error(400, "Invalid lightning address domain");
      }
    } else {
      let candidate = address;
      if (
        !candidate.startsWith("http://") &&
        !candidate.startsWith("https://")
      ) {
        if (candidate.includes("/")) {
          candidate = `https://${candidate}`;
        }
      }
      try {
        urlInput = new URL(candidate);
      } catch {
        throw error(400, "Invalid lightning address");
      }

      domain = urlInput.hostname;
      const path = urlInput.pathname || "/";
      if (
        path.startsWith("/.well-known/lnurlp/") ||
        path.startsWith("/lnurlp/") ||
        path.startsWith("/p/")
      ) {
        lnurlpUrl = urlInput;
      } else {
        const segments = path.split("/").filter(Boolean);
        if (segments.length === 1) {
          const name = segments[0];
          const loweredDomain = domain.toLowerCase();
          const isCoinos =
            loweredDomain === COINOS_HOST ||
            loweredDomain.endsWith(`.${COINOS_HOST}`);
          const resolvedPath = isCoinos
            ? `/p/${encodeURIComponent(name)}`
            : `/.well-known/lnurlp/${encodeURIComponent(name.toLowerCase())}`;
          lnurlpUrl = new URL(`https://${domain}${resolvedPath}`);
        } else {
          throw error(400, "Invalid lightning address");
        }
      }
    }
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
    lnAddress,
  });
};
