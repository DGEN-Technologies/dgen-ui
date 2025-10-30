import { redirect } from "@sveltejs/kit";

export async function load({ cookies, url, parent }) {
  if (!cookies.get("token"))
    redirect(307, `/register?redirect=${url.pathname}`);

  // Browser SDK handles all wallet operations
  // Return parent data so child components have access to user
  return await parent();
}