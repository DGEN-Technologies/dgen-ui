import { redirect } from "@sveltejs/kit";
import getRates from "$lib/rates";

export async function load({ params, parent, url, fetch }) {
  const { user } = await parent();
  if (!user) redirect(307, "/login");

  const { address } = params;
  const asset = url.searchParams.get("asset") || "lbtc";

  const rates = await getRates(fetch, url);

  // Browser SDK will provide wallet balance
  return {
    user,
    address,
    asset,
    rate: rates[user.currency] || 0
  };
}