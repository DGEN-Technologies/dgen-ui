import getRates from "$lib/rates";
// import { g } from "$lib/utils"; // Unused import

export async function load({ depends, parent, fetch, url }) {
  depends("app:user");

  const rates = await getRates(fetch, url);
  const { subject } = await parent();
  // const { subject, user } = await parent(); // user is unused

  // const { follows, followers } = await g(`/${subject.pubkey}/count`, fetch, {});
  // let followList = new Promise((r) => r([]));
  // if (user)
  // 	followList = get(`/${user.pubkey}/follows?pubkeysOnly=true`).catch(
  // 		() => [],
  // 	);

  const followList = new Promise((r) => r([]));
  const follows = [];
  const followers = [];

  return {
    follows,
    followers,
    followList,
    rate: subject?.currency ? rates[subject.currency] : null,
  };
}
