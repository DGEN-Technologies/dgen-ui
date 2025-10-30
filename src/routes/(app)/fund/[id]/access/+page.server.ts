import { auth, fd, g, p } from "$lib/utils";
import { fail } from "@sveltejs/kit";

export const load = async ({ params: { id } }) => {
  const managers = await g(`/fund/${id}/managers`, fetch, {});
  return { managers, id };
};

export const actions = {
  default: async ({ cookies, request, fetch }) => {
    const form = await fd(request);

    try {
      const managers = await p("/fund/managers", form, fetch, auth(cookies));

      return { managers };
    } catch (e) {
      const { message } = e as Error;
      return fail(400, { message });
    }
  },
};
