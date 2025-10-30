import parse from "$lib/parse";
import { auth, fd, g } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";

const limit = 10;
export async function load({ cookies, depends, params, parent, url, fetch }) {
  depends("app:contacts");
  const { user } = await parent();
  if (!user) redirect(307, "/login");
  const { text } = params;

  if (text) await parse(text, url.host);
  const contacts = await g(`/contacts/${limit}`, fetch, auth(cookies));

  return { contacts, text: text || "" };
}

export const actions = {
  default: async ({ request, url, cookies }) => {
    const formData = await request.formData();
    let text = formData.get("text") as string;
    const asset = formData.get("asset") as string;
    
    if (!text) {
      return fail(400, { error: "No destination provided" });
    }
    
    // Trim whitespace and newlines from the input
    text = text.trim();
    
    // Detect payment type
    const lower = text.toLowerCase();
    let paymentType = "unknown";
    
    if (lower.startsWith("lnbc") || lower.startsWith("lntb") || lower.startsWith("lightning:") || lower.startsWith("lno1")) {
      // BOLT11 invoices start with lnbc/lntb, BOLT12 offers start with lno1
      paymentType = "lightning";
    } else if (lower.startsWith("bitcoin:") || lower.startsWith("bc1") || lower.startsWith("tb1") || lower.startsWith("1") || lower.startsWith("3")) {
      paymentType = "bitcoin";
    } else if (lower.startsWith("liquidnetwork:") || lower.startsWith("lq1") || lower.startsWith("ex1") || lower.startsWith("ert1") ||
               /^[VCT][A-Za-z0-9]{50,}$/.test(text.trim()) || /^[2][A-Za-z0-9]{33,}$/.test(text.trim())) {
      // Liquid: Bech32 (lq1, ex1, ert1) or Base58 confidential (V, CT, 2)
      paymentType = "liquid";
    } else if (lower.includes("@") && !lower.includes(" ")) {
      paymentType = "lnurl";
    }
    
    // Route to appropriate handler based on payment type
    // Keep the full text for proper BIP21/URI parsing by the SDK
    if (paymentType === "liquid") {
      // Default to lbtc if no asset specified
      const selectedAsset = asset || "lbtc";
      redirect(307, `/send/liquid/${encodeURIComponent(text)}?asset=${selectedAsset}`);
    } else if (paymentType === "bitcoin") {
      redirect(307, `/send/bitcoin/${encodeURIComponent(text)}`);
    } else if (paymentType === "lightning") {
      redirect(307, `/send/lightning/${encodeURIComponent(text)}`);
    } else if (paymentType === "lnurl") {
      // Handle Lightning address
      redirect(307, `/send/lightning/${encodeURIComponent(text)}`);
    } else {
      return fail(400, { error: "Unsupported payment type" });
    }
  },
};
