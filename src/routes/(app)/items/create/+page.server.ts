import { fail, redirect } from "@sveltejs/kit";
import { fd, auth, p } from "$lib/utils";

export const actions = {
  default: async ({ cookies, request, url, fetch }) => {
    const form = await fd(request);
    try {
      await p("/items", form, fetch, auth(cookies));
    } catch (e: any) {
      return fail(400, { message: e.message });
    }

    const success = `/${url.pathname.split("/")[1]}`;
    redirect(307, success);
  },
};
