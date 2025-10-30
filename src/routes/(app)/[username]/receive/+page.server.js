import getRates from "$lib/rates";
import { redirect } from "@sveltejs/kit";

export const load = async ({ cookies, params: { username }, parent, url, fetch }) => {
  const token = cookies.get("token");
  const rates = await getRates(fetch);
  if (!token) redirect(307, `/pay/${username}`);
  const { subject, user } = await parent();

  // If viewing someone else's receive page, redirect to pay page
  if (user?.username !== username) redirect(307, `/pay/${username}`);

  // Browser SDK handles all wallet operations
  // No server checks needed

  return {
    rate: subject?.currency ? rates[subject.currency] : null,
    text: `${username}@${url.host}`,
  };
};
