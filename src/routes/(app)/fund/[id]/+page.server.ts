import { auth, p } from "$lib/utils";
import { redirect } from "@sveltejs/kit";

export const actions = {
  default: async ({ cookies, locals, params, fetch }) => {
    const { user } = locals;

    if (user) {
      await p("/redeem", params, fetch, auth(cookies));
      redirect(307, "/payments");
    }

    redirect(307, "/register");
  },
};
