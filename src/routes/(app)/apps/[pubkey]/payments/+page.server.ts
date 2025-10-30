import { auth, g } from "$lib/utils";

export const load = async ({ cookies, params, fetch }) => {
  const app = await g(`/app/${params.pubkey}`, fetch, auth(cookies));
  return { app };
};
