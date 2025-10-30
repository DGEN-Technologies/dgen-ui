import { auth, g } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";

export async function load({ cookies, url, fetch }) {
  // Square integration disabled for now
  // let connected;
  // const query = url.searchParams.toString();
  // try {
  //   await g(`/square/auth?${query}`, fetch, auth(cookies));
  //   connected = true;
  // } catch (e) {
  //   const { message } = e as Error;
  //   fail(400, { message });
  // }
  // if (connected) redirect(307, "/settings/account");
  
  // Just redirect back to settings for now
  redirect(307, "/settings/account");
}
