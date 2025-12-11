import { redirect } from "@sveltejs/kit";

export async function load({ cookies, url, parent }) {
  if (!cookies.get("token"))
    redirect(307, `/register?redirect=${url.pathname}`);
  return await parent();
}
