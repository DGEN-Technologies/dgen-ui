import { auth, g } from "$lib/utils";
import { redirect } from "@sveltejs/kit";

export async function load({ cookies, fetch }) {
  const token = cookies.get("token");
  if (!token) redirect(307, "/login");
  const user = await g("/me", fetch, auth(cookies));
  if (!user) redirect(307, "/login");

  return { user };
}
