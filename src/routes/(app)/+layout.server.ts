import { auth, g, sleep } from "$lib/utils";
import { error, redirect } from "@sveltejs/kit";

export async function load({ cookies, request, url, params, fetch }) {
  const { pathname } = url;
  const { id, username } = params;
  const token = cookies.get("token");

  let user;
  if (token) {
    try {
      user = await g("/me", fetch, auth(cookies));
    } catch (e) {
      const { message } = e as Error;
      if (message.startsWith("Rate")) await sleep(3000);
      user = await g("/me", fetch, auth(cookies));
    }
  }

  let subject;

  if (url.pathname.includes("/invoice") && id) {
    try {
      ({ user: subject } = await g(`/invoice/${id}`, fetch, {}));
    } catch (e) {
      console.log("unable to fetch invoice", id, e);
    }
  } else if (username) {
    try {
      subject = await g(`/users/${username}`, fetch, {});
    } catch (e) {
      error(500, "Unable to retrieve user account data");
    }
  }

  if (user?.needsMigration) {
    redirect(307, "/migrate");
  }

  if (
    user &&
    ["/login", "/register"].includes(pathname) &&
    request.method === "GET"
  ) {
    redirect(307, `/${user.username}`);
  }

  // REMOVED: Wallet setup check - all users have auto-generated wallets
  // Never redirect to wallet/setup - users can immediately use their wallets

  // Force dark mode only for now - light mode needs more work
  const theme = "dark"; // cookies.get("theme") || "light";

  return { user, token, subject, theme };
}
