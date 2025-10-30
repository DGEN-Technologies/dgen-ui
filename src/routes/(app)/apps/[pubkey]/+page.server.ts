import getRates from "$lib/rates";
import { auth, fd, g, p } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";

export const load = async ({ cookies, params, parent, fetch }) => {
  const { pubkey } = params;
  const { user } = await parent();
  const rates = await getRates(fetch);
  const rate = rates[user.currency];
  const app = await g(`/app/${pubkey}`, fetch, auth(cookies));
  return { app, rate };
};

export const actions = {
  default: async ({ cookies, request, fetch }) => {
    try {
      const body = await fd(request);
      await p("/app", body, fetch, auth(cookies));
    } catch (e) {
      const { message: error } = e as Error;
      return fail(400, { error });
    }

    redirect(307, "/settings/nostr");
  },
};
