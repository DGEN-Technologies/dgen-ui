export const PROPAGATION_MESSAGE =
  "Your previous transaction is still propagating. Please wait a moment and try again.";

const PROPAGATION_HINTS = [
  "bad-txns-inputs-missingorspent",
  "Failed to parse response to txid",
  "sendrawtransaction RPC error -25",
  "ESPLORA_UPSTREAM_4XX",
  "Upstream request rejected",
];

export const mapTxError = (
  message: string | null | undefined,
  fallback = "Payment failed",
): string => {
  const text = message?.trim() ?? "";
  if (!text) return fallback;
  if (PROPAGATION_HINTS.some((hint) => text.includes(hint))) {
    return PROPAGATION_MESSAGE;
  }
  return text;
};
