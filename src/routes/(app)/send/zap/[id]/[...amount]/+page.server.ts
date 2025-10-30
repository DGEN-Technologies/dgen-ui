import getRates from "$lib/rates";
import { auth, fd, p } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";

export async function load({ cookies, params, parent, url, fetch }) {
  const { user } = await parent();
  const { amount, id } = params;
  const rates = await getRates(fetch, url);

  let request;
  // Nostr zap functionality disabled
  // if (amount)
  //   request = await p("/zapRequest", { amount, id }, fetch, auth(cookies));

  const rate = rates[user.currency];
  return { amount, id, rates, rate, request };
}

export const actions = {
  setAmount: async ({ cookies, params, request, fetch }) => {
    const data = await fd(request);
    const { id } = params;
    const { amount } = data;

    // Nostr zap functionality disabled
    // data.request = await p("/zapRequest", { amount, id }, fetch, auth(cookies));

    return data;
  },

  send: async ({ cookies, request, fetch }) => {
    let payment;
    try {
      const body = await fd(request);

      payment = await p("/payments", body, fetch, auth(cookies));
      console.log("Payment", payment);
    } catch (_) {
      console.log("WHAT", _);
      return fail(400, { message: "payments.failedToRoute" });
    }

    redirect(307, `/sent/${payment.id}`);
  },
};
