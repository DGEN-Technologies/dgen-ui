import { redirect } from "@sveltejs/kit";

export async function load({ params, parent, url }) {
  const { user } = await parent();
  if (!user) redirect(307, "/login");
  
  const { address } = params;
  const asset = url.searchParams.get("asset") || "lbtc";
  
  // Browser SDK will provide wallet balance
  return { 
    user,
    address,
    asset
  };
}