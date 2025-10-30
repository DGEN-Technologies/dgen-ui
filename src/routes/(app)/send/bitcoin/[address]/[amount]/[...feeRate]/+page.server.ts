// Browser SDK handles all Bitcoin onchain payment operations
export async function load({ params }) {
  // Just pass through the params, browser SDK will handle everything
  return {
    address: params.address,
    amount: parseInt(params.amount),
    feeRate: params.feeRate ? parseInt(params.feeRate) : undefined
  };
}