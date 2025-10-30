import getRates from "$lib/rates";
import { auth, fd, g, p } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";

export async function load({ params, parent, fetch }) {
  const { user } = await parent();
  if (!user) redirect(307, "/register");
  const rates = await getRates(fetch);
  const rate = rates[user.currency];
  const fund = await g(`/fund/${params.id}`, fetch, {});
  const { amount: balance } = fund;
  return { ...params, balance, rate };
}

export const actions = {
  default: async ({ cookies, request, fetch }) => {
    const body = await fd(request);
    try {
      await p("/take", body, fetch, auth(cookies));
    } catch (e) {
      const { message } = e as Error;
      return fail(400, { message });
    }

    redirect(307, `/fund/${body.id}`);
  },
};
