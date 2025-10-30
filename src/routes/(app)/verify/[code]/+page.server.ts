import { g } from "$lib/utils";
import { redirect } from "@sveltejs/kit";

export const load = async ({ params: { code } }) => {
  // let user; // user is unused
  try {
    await g(`/verify/${code}`, fetch, {});
  } catch (e) {
    console.log(e);
    return { error: "Verification failed" };
  }

  redirect(307, "/settings/account?verified=true");
};
