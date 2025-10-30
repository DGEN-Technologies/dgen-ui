import getRates from "$lib/rates";
import { auth, fd, p } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";

export async function load({ parent, fetch }) {
  const { user } = await parent();
  const rates = await getRates(fetch);
  return { rate: rates[user?.currency || "USD"] };
}

export const actions = {
  default: async ({ cookies, request, url, fetch }) => {
    if (!cookies.get("username"))
      redirect(307, `/register?redirect=${url.pathname}`);

    const { token } = await fd(request);
    let claimed;
    try {
      claimed = await p("/claim", { token }, fetch, auth(cookies));
      claimed = { ok: true };
    } catch (e: any) {
      return fail(400, { error: e.message });
    }
    if (claimed?.ok) {
      redirect(307, "/payments");
    }
  },
};
