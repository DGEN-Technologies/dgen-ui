import getRates from "$lib/rates";

export async function load({ parent, url, fetch }) {
  const { user } = await parent();
  const rates = await getRates(fetch, url);
  // Balance will be retrieved from SDK in browser
  return { rate: rates[user.currency] };
}