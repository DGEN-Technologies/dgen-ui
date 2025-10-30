import getRates from "$lib/rates";
import updateUser from "$lib/settings";
import { auth, g } from "$lib/utils";

export async function load({ cookies, fetch, url }) {
  const rates = await getRates(fetch, url);
  // Square integration disabled for now
  // const connect = await g("/square/connect", fetch, auth(cookies));
  const connect = null;
  return { connect, rates };
}

export const actions = {
  default: updateUser,
};
