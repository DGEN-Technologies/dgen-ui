import { PUBLIC_DOMAIN } from "$env/static/public";
import { browser } from "$app/environment";
import { decode } from "$lib/bip21";
import { get, post } from "$lib/utils";
import { redirect } from "@sveltejs/kit";
import * as walletService from "$lib/walletService";
import { adapters } from "$lib/rails";
import { getSparkSdk } from "$lib/rails/spark";

export default async (s, host) => {
  if (!s) return;
  let t = s.trim();
  let invoice;
  let user;

  if (t.startsWith("http")) redirect(307, t);
  if (t.startsWith(host)) redirect(307, `http://${t}`);

  if (t.includes("lightning=")) {
    const url = new URL(t);
    const params = new URLSearchParams(url.search);
    t = params.get("lightning");
  }

  if (t.startsWith("lightning:")) t = t.replace("lightning:", "");
  if (t.endsWith(`@${PUBLIC_DOMAIN}`)) t = t.split("@")[0];

  if (t.toLowerCase().startsWith("nostr:")) {
    t = t.split(":")[1];
  }

  if (["note", "nevent"].some((p) => t.startsWith(p))) redirect(307, `/e/${t}`);
  if (["nprofile", "npub"].some((p) => t.startsWith(p))) redirect(307, `/${t}`);

  // Try to parse with a connected SDK if available (client-side only)
  if (
    browser &&
    (adapters.spark.isConnected() || adapters.liquid.isConnected())
  ) {
    try {
      const sdk = getSparkSdk();
      const parsed = sdk
        ? await sdk.parse(t)
        : await walletService.parseInput(t);

      switch (parsed.type) {
        case "bitcoinAddress": {
          // Extract amount from BIP21 if present
          let amount;
          if (
            t.toLowerCase().startsWith("bitcoin:") ||
            t.toLowerCase().startsWith("liquidnetwork:")
          ) {
            try {
              const decoded = decode(t);
              amount = decoded.options?.amount;
            } catch (e) {
              // Ignore decode errors
            }
          }

          // Spark's InputType flattens BitcoinAddressDetails onto the union
          // member, so `parsed.address` is already the address string.
          // Liquid's InputType nests it: `parsed.address` is an object whose
          // own `.address` is the string. Handle both shapes.
          const address =
            typeof parsed.address === "string"
              ? parsed.address
              : parsed.address.address;
          let route = `/send/bitcoin/${address}`;
          if (amount) route += `/${Math.round(amount * 100000000)}`;
          redirect(307, route);
          break;
        }

        // "bolt11" is Liquid's discriminant, "bolt11Invoice" is Spark's —
        // both SDKs can be the active parser here, so both are handled.
        case "bolt11":
        case "bolt11Invoice": {
          // Check if this is an invoice in our database first
          let foundInvoice = null;
          try {
            foundInvoice = await get(`/invoice/${t}`);
            if (foundInvoice?.user?.username === "mint") {
              foundInvoice = null;
            }
          } catch (e) {
            // Not in our DB
          }
          if (foundInvoice) {
            redirect(307, `/invoice/${foundInvoice.id}`);
          } else {
            redirect(307, `/send/lightning/${t}`);
          }
          break;
        }

        case "bolt12Offer": {
          // Spark cannot pay a BOLT12 offer. Still route to the send screen
          // rather than failing here, so the explanation reaches the user in
          // the one place that already renders payment errors.
          redirect(307, `/send/lightning/${t}`);
          break;
        }

        // "lnUrlPay" is Liquid's discriminant, "lnurlPay" is Spark's.
        case "lnUrlPay":
        case "lnurlPay": {
          // LNURL-Pay and Lightning addresses - redirect to LNURL handler
          redirect(307, `/ln/${t}`);
          break;
        }

        // Spark reports a Lightning address as its own type; Liquid folded it
        // into lnUrlPay. Without this case, scanning a friend's
        // alice@getalby.com QR fell through to the default branch and the
        // user landed on a blank send page with no explanation.
        case "lightningAddress": {
          redirect(307, `/ln/${t}`);
          break;
        }

        // Likewise bip21: Liquid parsed a "bitcoin:..." URI straight to
        // bitcoinAddress, Spark wraps it. The payload carries the concrete
        // instruments in paymentMethods, so recurse into the first one we
        // already know how to route.
        case "bip21": {
          const details = parsed as unknown as {
            amountSat?: number;
            paymentMethods?: Array<Record<string, any>>;
          };
          const method = (details.paymentMethods ?? []).find((m) =>
            ["bitcoinAddress", "bolt11Invoice", "bolt11", "lnurlPay"].includes(
              m?.type,
            ),
          );
          const addr =
            typeof method?.address === "string"
              ? method.address
              : method?.address?.address;
          if (addr) {
            const amt = details.amountSat;
            redirect(
              307,
              amt ? `/send/bitcoin/${addr}/${amt}` : `/send/bitcoin/${addr}`,
            );
          }
          // No routable instrument inside; fall through to legacy handling
          // rather than redirecting somewhere with undefined in the URL.
          break;
        }

        // "lnUrlWithdraw" is Liquid's discriminant, "lnurlWithdraw" is Spark's.
        case "lnUrlWithdraw":
        case "lnurlWithdraw": {
          // LNURL-Withdraw - redirect to LNURL handler
          redirect(307, `/ln/${t}`);
          break;
        }

        // "lnUrlAuth" is Liquid's discriminant, "lnurlAuth" is Spark's.
        case "lnUrlAuth":
        case "lnurlAuth": {
          // LNURL-Auth - redirect to LNURL handler
          redirect(307, `/ln/${t}`);
          break;
        }

        default:
          // Unknown SDK type, fall through to legacy handling
          console.log("[Parse] Unknown SDK parse type:", parsed.type);
          break;
      }
    } catch (sdkError) {
      console.log("[Parse] SDK parse failed, trying legacy methods:", sdkError);
      // Fall through to legacy handling
    }
  }

  // Legacy handling for when SDK not available (SSR, not logged in, parse failed)
  // Also handles app-specific inputs (users, funds, ecash, etc.)

  if (t.match(/^🥜([\uFE00-\uFE0F]|[\uE0100-\uE01EF]+)$/)) {
    t = (Array.from(t) as string[])
      .slice(1)
      .map((char: string) => {
        const codePoint = char.codePointAt(0);
        if (!codePoint) return "";

        // Handle Variation Selectors (VS1-VS16): U+FE00 to U+FE0F
        if (codePoint >= 0xfe00 && codePoint <= 0xfe0f) {
          const byteValue = codePoint - 0xfe00;
          return String.fromCharCode(byteValue);
        }

        // Handle Variation Selectors Supplement (VS17-VS256): U+E0100 to U+E01EF
        if (codePoint >= 0xe0100 && codePoint <= 0xe01ef) {
          const byteValue = codePoint - 0xe0100 + 16;
          return String.fromCharCode(byteValue);
        }

        return "";
      })
      .join("");
  }

  if (t.startsWith("cashu")) {
    const { id } = await post("/cash", { token: t });
    redirect(307, `/ecash/${id}`);
  }

  if (t.startsWith("creq")) redirect(307, `/send/ecash/${t}`);

  // Check for app-specific user lookup
  try {
    user = await get(`/users/${t.split("/")[0]}`);
    if (user.anon) user = null;
  } catch (e) {}

  if (user) redirect(307, `/pay/${t}`);

  // Check for app-specific fund lookup
  let fund;
  if (t.includes("/fund")) redirect(307, t.substring(t.indexOf("/fund")));

  try {
    fund = await get(`/fund/${t}`);
  } catch (e) {}

  if (fund) redirect(307, `/send/fund/${t}`);

  // Check for app-specific invoice lookup
  try {
    invoice ||= await get(`/invoice/${t}`);
  } catch (e) {}

  if (invoice) redirect(307, `/invoice/${invoice.id}`);
};
