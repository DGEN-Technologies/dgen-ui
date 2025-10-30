import getRates from "$lib/rates";
import { auth, fd, g, p, sats, types } from "$lib/utils";
import { error, fail, redirect } from "@sveltejs/kit";

export async function load({ cookies, params, parent, url, fetch }) {
  const { username } = params;
  const { user } = await parent();
  const rates = await getRates(fetch, url);

  if (user?.username === username) redirect(307, `/${username}/receive`);
  const subject = await g(`/users/${username}`, fetch, {});

  let [amount, currency] = params.amount.split("/");

  const rate = rates[currency ? currency.toUpperCase() : subject.currency];
  if (currency && !rate) error(500, "Invalid currency symbol");

  if (amount) {
    if (currency) amount = (amount * sats) / rate;

    const { id } = await p("/invoice", {
        invoice: {
          amount,
          currency: currency === subject.currency ? currency : undefined,
          prompt: false,
          rate: currency === subject.currency ? rate : undefined,
          type: types.lightning,
        },
        user: { username },
      },
      fetch,
      auth(cookies),
    );

    redirect(307, `/invoice/${id}`);
  }

  return { amount, rate, subject };
}

export const actions = {
  default: async ({ cookies, request, fetch }) => {
    let id;
    const body = await fd(request);
    const { amount, rate, prompt, type, username } = body;

    try {
      ({ id } = await p("/invoice", {
          invoice: {
            amount,
            rate,
            prompt,
            type,
          },
          user: { username },
        },
        fetch,
        auth(cookies),
      ));
    } catch (e) {
      const { message } = e as Error;
      return fail(400, { message });
    }

    if (parseInt(amount) > 0 && prompt) redirect(307, `/invoice/${id}/tip`);
    else if (parseInt(amount) <= 0) redirect(307, `/${username}/receive`);
    redirect(307, `/invoice/${id}`);
  },
};
