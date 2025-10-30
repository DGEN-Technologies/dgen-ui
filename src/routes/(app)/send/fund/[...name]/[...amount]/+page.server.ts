import getRates from "$lib/rates";
import { auth, fd, p } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";

export async function load({ parent, params, url, fetch }) {
  let { name, amount } = params;
  if (!name) name = crypto.randomUUID();
  const { user } = await parent();
  const rates = await getRates(fetch, url);
  const rate = rates[user.currency];
  return { name, amount, rate };
}

export const actions = {
  default: async ({ cookies, request, fetch }) => {
    const body = await fd(request);
    let p;

    try {
      p = await p("/payments", body, fetch, auth(cookies));
    } catch (e) {
      const { message } = e as Error;
      return fail(400, { message });
    }

    if (p) redirect(307, `/fund/${body.fund}`);
  },
};
