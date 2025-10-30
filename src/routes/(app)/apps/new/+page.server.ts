import getRates from "$lib/rates";
import { auth, fd, p } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";

export const load = async ({ parent, url, fetch }) => {
  const { user } = await parent();

  if (!user)
    redirect(
      307,
      `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`,
    );

  let max_amount = url.searchParams.get("max_amount");
  max_amount = max_amount ? Math.round(Number(max_amount) / 1000) : undefined;

  const app = {
    name: url.searchParams.get("name"),
    pubkey: url.searchParams.get("pubkey"),
    max_amount,
    budget_renewal: url.searchParams.get("budget_renewal"),
  };

  const rates = await getRates(fetch);
  const rate = rates[user.currency];
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
