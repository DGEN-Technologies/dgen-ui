import { browser } from "$app/environment";
import { resolvePaymentStatus } from "$lib/paymentStatus";

/**
 * Load the payment this route's id refers to.
 *
 * Both rails are read. This route used to call `walletService.getTransactions()`
 * alone, which is `sdk.listPayments()` on the Breez SDK-Liquid instance and so
 * returns Liquid payments only. The history list it is reached from reads the
 * rails layer and shows BOTH rails, so every Lightning row rendered in the list
 * and then resolved to nothing when opened — "Payment Not Found" on a payment
 * the user could see a moment earlier.
 *
 * The connectivity gate is per-rail for the same reason: gating the whole
 * lookup on Liquid meant a Liquid outage took the detail page down for Spark
 * payments too, which do not depend on it.
 */
export async function load({ params, parent }) {
  const parentData = await parent();

  if (browser) {
    try {
      const walletService = await import("$lib/walletService");
      const { adapters } = await import("$lib/rails");
      const { toLegacyPayment } = await import("$lib/rails/legacy");
      const { getPaymentId } = await import("$lib/transactionService");

      const liquidConnected = walletService.isConnected();
      const sparkConnected = adapters.spark.isConnected();

      if (!liquidConnected && !sparkConnected) {
        console.warn("[Payment] no rail connected, cannot resolve payment");
      } else {
        // A failing rail contributes nothing rather than failing the lookup —
        // the payment may well live on the other one.
        const [liquidResult, sparkResult] = await Promise.allSettled([
          liquidConnected
            ? walletService.getTransactions()
            : Promise.resolve([]),
          sparkConnected
            ? adapters.spark.listPayments(100)
            : Promise.resolve([]),
        ]);

        if (liquidResult.status === "rejected") {
          console.warn("[Payment] Liquid lookup failed:", liquidResult.reason);
        }
        if (sparkResult.status === "rejected") {
          console.warn("[Payment] Spark lookup failed:", sparkResult.reason);
        }

        const liquidTx =
          liquidResult.status === "fulfilled" ? liquidResult.value : [];
        const sparkTx = (
          sparkResult.status === "fulfilled" ? sparkResult.value : []
        ).map(toLegacyPayment);

        const transactions = [...liquidTx, ...sparkTx];

        // getPaymentId is the function the list and the cache key on, so a
        // link built from a listed row resolves here by construction. The
        // remaining comparisons stay for ids minted elsewhere — a send screen
        // redirecting with the SDK's own id before the list has ever run.
        const payment = transactions.find(
          (tx) =>
            getPaymentId(tx) === params.id ||
            tx.txId === params.id ||
            tx.id === params.id ||
            tx.paymentHash === params.id ||
            tx.details?.paymentHash === params.id,
        );

        if (payment) {
          // Rates are fetched only once a payment is in hand; a miss does not
          // need them, and the Liquid-backed call is the slowest step here.
          //
          // The 50000 fallback is a fabricated BTC price and is wrong, but
          // +page.svelte divides by `rate` and formats it directly, so a null
          // here renders NaN rather than hiding fiat. Left as-is: removing it
          // needs the three call sites in that file, not this one.
          let rate = 50000;
          try {
            const fiatRates = await walletService.fetchFiatRates();
            const usdRate = fiatRates.find(
              (r) => r.coin.toUpperCase() === "USD",
            );
            if (usdRate) rate = usdRate.value;
          } catch (e) {
            console.warn("Failed to fetch fiat rates:", e);
          }

          const resolvedStatus = resolvePaymentStatus(payment);
          return {
            payment: {
              ...payment,
              id: getPaymentId(payment),
              rate,
              currency: parentData.user?.currency || "USD",
              status: resolvedStatus ?? payment.status,
              created: payment.timestamp
                ? payment.timestamp * 1000
                : payment.paymentTime * 1000,
              amount:
                payment.paymentType === "receive"
                  ? payment.amountSat
                  : -payment.amountSat,
            },
            user: parentData.user,
          };
        }
      }
    } catch (error) {
      console.error("[Payment] Failed to load payment:", error);
    }
  }

  return {
    payment: null,
    user: parentData.user,
  };
}
