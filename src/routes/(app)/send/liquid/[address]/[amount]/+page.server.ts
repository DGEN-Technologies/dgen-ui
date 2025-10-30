import { auth } from "$lib/utils";
import { redirect } from "@sveltejs/kit";

export async function load({ cookies, params, parent, url, fetch }) {
  const { user } = await parent();
  if (!user) redirect(307, "/login");
  
  const { address, amount } = params;
  const asset = url.searchParams.get("asset") || "lbtc";
  
  const parsedAmount = parseInt(amount);
  
  // Validate amount
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    // Redirect back to amount entry page
    redirect(307, `/send/liquid/${address}?asset=${asset}`);
  }
  
  return { 
    user,
    address,
    amount: parsedAmount,
    asset
  };
}