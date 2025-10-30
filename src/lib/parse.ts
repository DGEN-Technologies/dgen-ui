import { PUBLIC_DOMAIN } from "$env/static/public";
import { browser } from "$app/environment";
import { decode } from "$lib/bip21";
import { get, post } from "$lib/utils";
import { redirect } from "@sveltejs/kit";
import * as walletService from "$lib/walletService";

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

  // Try to parse with Breez SDK if connected (client-side only)
  if (browser && walletService.isConnected()) {
    try {
      const parsed = await walletService.parseInput(t);

      switch (parsed.type) {
        case 'bitcoinAddress': {
          // Extract amount from BIP21 if present
          let amount;
          if (t.toLowerCase().startsWith("bitcoin:") || t.toLowerCase().startsWith("liquidnetwork:")) {
            try {
              const decoded = decode(t);
              amount = decoded.options?.amount;
            } catch (e) {
              // Ignore decode errors
            }
          }

          const address = parsed.address.address;
          let route = `/send/bitcoin/${address}`;
          if (amount) route += `/${Math.round(amount * 100000000)}`;
          redirect(307, route);
          break;
        }

        case 'bolt11': {
          // Check if this is an invoice in our database first
          try {
            invoice = await get(`/invoice/${t}`);
            if (invoice?.user?.username === "mint") throw new Error("mint payment");
            redirect(307, `/invoice/${invoice.id}`);
          } catch (e) {
            // Not in our DB, proceed with payment
            redirect(307, `/send/lightning/${t}`);
          }
          break;
        }

        case 'bolt12Offer': {
          // BOLT12 offers - redirect to send page
          redirect(307, `/send/lightning/${t}`);
          break;
        }

        case 'lnUrlPay': {
          // LNURL-Pay and Lightning addresses - redirect to LNURL handler
          redirect(307, `/ln/${t}`);
          break;
        }

        case 'lnUrlWithdraw': {
          // LNURL-Withdraw - redirect to LNURL handler
          redirect(307, `/ln/${t}`);
          break;
        }

        case 'lnUrlAuth': {
          // LNURL-Auth - redirect to LNURL handler
          redirect(307, `/ln/${t}`);
          break;
        }

        default:
          // Unknown SDK type, fall through to legacy handling
          console.log('[Parse] Unknown SDK parse type:', parsed.type);
          break;
      }
    } catch (sdkError) {
      console.log('[Parse] SDK parse failed, trying legacy methods:', sdkError);
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
