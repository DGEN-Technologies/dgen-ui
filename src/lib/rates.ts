import { get, g } from "$lib/utils";
import * as walletService from "$lib/walletService";

let last;
let rates;

export default async function getRates(fetchFn = fetch, url?: any) {
  // Use 30-second cache like Breez SDK example
  if (!rates || Date.now() - last > 30000) {
    try {
      // Try SDK first if available (client-side only)
      if (typeof window !== 'undefined' && walletService.isConnected()) {
        try {
          const sdkRates = await walletService.fetchFiatRates();
          console.log('[Rates] Fetched from SDK:', sdkRates.length, 'currencies');

          // Convert SDK Rate[] format to your rates object format
          // SDK returns: [{ coin: "USD", value: 96000.0 }, ...]
          // Convert to: { usd: 96000.0, ... }
          rates = sdkRates.reduce((acc, rate) => {
            acc[rate.coin.toLowerCase()] = rate.value;
            return acc;
          }, {} as Record<string, number>);

          last = Date.now();
          return rates;
        } catch (sdkError) {
          console.log('[Rates] SDK fetch failed, falling back to server:', sdkError);
        }
      }

      // Fallback to server (for SSR or when SDK unavailable)
      const origin = url?.origin;
      rates = await (typeof window === 'undefined'
        ? g("/rates", fetchFn, {}, origin)
        : get("/rates"));
      last = Date.now();

    } catch (error) {
      console.error("[Rates] Failed to fetch from both SDK and server:", error);
      // Keep stale rates if both fail
      rates = rates || {};
    }
  }

  return rates || {};
}
