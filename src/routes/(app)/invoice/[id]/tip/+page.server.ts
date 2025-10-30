import getRates from "$lib/rates";
import { auth, fd, g, p } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";

export async function load({ cookies, params, parent, fetch }) {
  const { id } = params;
  const rates = await getRates(fetch);
  let { invoice, subject, user } = await parent();
  if (!invoice.amount) redirect(307, `/invoice/${invoice.id}`);
  const pin = cookies.get("pin");

  if (user) {
    const trust = await g("/trust", fetch, auth(cookies));
    const trusted = trust.includes(invoice.uid);
    if (trusted && (pin || !user.haspin)) {
      let p;
      try {
        if (invoice.tip === null && invoice.user.prompt) {
          if (user.tip > 0) {
            invoice.tip = Math.round(invoice.amount * (user.tip / 100));
            invoice = await p(`/invoice/${id}`, { invoice }, fetch, auth(cookies));
          } else {
            throw new Error("tip");
          }
        }
        p = await p("/payments", { ...invoice, pin }, fetch, auth(cookies));
      } catch (e) {
        const { message } = e as Error;
        if (message === "tip") redirect(307, `/invoice/${id}/tip`);
        fail(400, { message });
      }
      if (p) redirect(307, `/sent/${p.id}`);
    }
  }

  const rate = rates[subject?.currency];
  const invoiceRate = rates[invoice.currency];
  return { rate, invoiceRate };
}

export const actions = {
  default: async ({ cookies, request, fetch }) => {
    const form = await fd(request);
    const invoice = {
      tip: form.tip ?? null,
    };

    const { id } = await p(`/invoice/${form.id}`, { invoice }, fetch, auth(cookies),
    );

    redirect(307, `/invoice/${id}`);
  },
};
