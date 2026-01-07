import getRates from "$lib/rates";

// Browser SDK handles all Lightning payment operations
export async function load({ params, parent, fetch }) {
  // Get user data from parent layout
  const { user } = await parent();

  // Fetch exchange rates
  const rates = await getRates(fetch);
  const rate = rates[user?.currency || "USD"];

  return {
    payreq: params.payreq,
    memo: params.memo,
    rate,
    currency: user?.currency || "USD",
  };
}
