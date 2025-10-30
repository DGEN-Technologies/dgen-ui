import { auth, g } from "$lib/utils";
import { redirect } from "@sveltejs/kit";

export async function load({ cookies, parent, fetch }) {
  const { user } = await parent();
  if (!user) redirect(307, "/login");

  const users = (await g("/users", fetch, auth(cookies))).sort(
    (a, b) => b.balance - a.balance,
  );
  return { users };
}
