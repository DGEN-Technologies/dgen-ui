// Browser SDK handles all Lightning payment operations
export async function load({ params }) {
  // Just pass through the params, browser SDK will handle everything
  return {
    payreq: params.payreq,
    memo: params.memo
  };
}