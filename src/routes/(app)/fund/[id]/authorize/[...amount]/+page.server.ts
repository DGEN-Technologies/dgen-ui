import getRates from "$lib/rates";
import { auth, g, p, sats } from "$lib/utils";
import { error, redirect } from "@sveltejs/kit";

export async function load({ cookies, params, parent, fetch }) {
  const { user } = await parent();
  const { id } = params;
  let [amount, currency] = params.amount.split("/");
  let fiat;

  if (!currency) currency = user?.currency;
  if (currency) currency = currency.toUpperCase();

  const rates = await getRates(fetch);
  const rate = rates[currency || "USD"];
  if (currency && !rate) error(500, "Invalid currency symbol");

  if (!amount) {
    const balance = await g(`/fund/${id}`, fetch, {});
    amount = balance.amount;
  } else if (currency) {
    fiat = amount;
    amount = Math.round((fiat * sats) / rate);
  }

  if (!amount) redirect(307, `/fund/${id}`);

  try {
    await p("/authorize", { amount, currency, fiat, id }, fetch, auth(cookies));
  } catch (e) {
    console.log("caught", e);
    redirect(307, `/fund/${id}`);
  }

  return { amount, currency, id, rate, rates };
}
