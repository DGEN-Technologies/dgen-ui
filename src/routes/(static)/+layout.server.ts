import { g, auth } from "$lib/utils";

export async function load({ cookies, fetch }) {
  const token = cookies.get("token");

  let user;
  if (token) {
    try {
      user = await g("/me", fetch, auth(cookies));
    } catch (e) {}
  }

  return { user };
}
