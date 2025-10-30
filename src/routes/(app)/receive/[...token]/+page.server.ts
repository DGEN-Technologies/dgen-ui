import { fd } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";
import parse from "$lib/parse";

export async function load({ params, parent, url, fetch }) {
  const { user } = await parent();
  if (!user) redirect(307, `/register?redirect=${url.pathname}`);

  // If no token provided, redirect to user's receive page
  if (!params.token || params.token.length === 0 || params.token[0] === '') {
    redirect(307, `/${user.username}/receive`);
  }

  await parse(params.token, url.host);
}

export const actions = {
  default: async ({ request, url }) => {
    const { text } = await fd(request);
    await parse(text, url.host);
    return fail(400, { error: "default" });
  },
};
