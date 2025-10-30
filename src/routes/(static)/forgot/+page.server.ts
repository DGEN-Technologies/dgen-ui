import { fail } from "@sveltejs/kit";
import { fd, p } from "$lib/utils";

export const actions = {
  default: async ({ request, fetch }) => {
    try {
      const { email } = await fd(request);
      await p("/forgot", { email }, fetch);
      return { success: true };
    } catch (e: any) {
      return fail(400, { error: e.message });
    }
  },
};
