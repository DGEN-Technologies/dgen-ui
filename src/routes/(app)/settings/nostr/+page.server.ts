import updateUser from "$lib/settings";
import { auth, g } from "$lib/utils";

export const load = async ({ cookies, fetch }) => {
  const { challenge } = await g("/challenge", fetch, {});
  const apps = await g("/apps", fetch, auth(cookies));
  return { apps, challenge };
};

export const actions = {
  default: updateUser,
};
