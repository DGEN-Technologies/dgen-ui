import getRates from "$lib/rates";
import { auth, fd, g, p, types } from "$lib/utils";
import { error, fail, redirect } from "@sveltejs/kit";

export async function load({ cookies, depends, params: { id }, parent, url, fetch }) {
  depends("app:trust");
  const { user } = await parent();
  // const { subject, user } = await parent(); // subject is unused
  const pin = cookies.get("pin");

  let invoice = await g(`/invoice/${id}`, fetch);

  const trust = await g("/trust", fetch, auth(cookies));
  const trusted = trust.includes(invoice.uid);
  if (trusted && (pin || !user.haspin)) {
    let payment;
    try {
      if (!invoice.tip && invoice.user.prompt) {
        if (user.tip > 0) {
          invoice.tip = Math.round(invoice.amount * (user.tip / 100));
          invoice = await p(`/invoice/${id}`, { invoice }, fetch, auth(cookies));
        } else {
          throw new Error("tip");
        }
      }
      payment = await p("/payments", { ...invoice, pin }, fetch, auth(cookies));
    } catch (e) {
      const { message } = e as Error;
      if (message === "tip") redirect(307, `/invoice/${id}/tip`);
      fail(400, { message });
    }
    if (payment) redirect(307, `/sent/${payment.id}`);
  }

  if (invoice.amount && invoice.prompt && invoice.tip === null)
    redirect(307, `/invoice/${id}/tip`);

  if (invoice.memoPrompt && invoice.memo === null)
    redirect(307, `/invoice/${id}/memo`);

  if (user && invoice.aid === user.id)
    error(500, { message: "Cannot send to self" });
  else if (user && ![types.lightning, types.bolt12].includes(invoice.type))
    redirect(
      307,
      `/send/${invoice.type === types.ecash ? "ecash" : "bitcoin"}/${
        invoice.hash
      }`,
    );

  if (!user) redirect(307, `/invoice/${id}`);

  const rates = await getRates(fetch, url);
  const rate = rates[user.currency];
  const invoiceRate = rates[invoice.currency];

  // Balance is managed by Breez SDK in the browser - no server-side balance needed
  return { invoice, user, rate, invoiceRate, trusted };
}

export const actions = {
  default: async ({ cookies, params: { id }, request, fetch }) => {
    let payment;
    try {
      const body = await fd(request);
      body.hash = id;

      payment = await p("/payments", body, fetch, auth(cookies));
    } catch (e) {
      const { message } = e as Error;
      console.log("payment failed", id, e);
      error(500, { message });
    }

    redirect(307, `/sent/${payment.id}`);
  },
};
