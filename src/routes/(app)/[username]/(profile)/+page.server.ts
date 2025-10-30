import getRates from "$lib/rates";
import { redirect } from "@sveltejs/kit";

export async function load({ depends, parent, fetch }) {
  depends("app:payments");
  depends("app:items");

  const { subject, user } = await parent();

  // Redirect to home if viewing someone else's profile
  // Only the user themselves can view their own profile
  if (!user || user.id !== subject.id) {
    throw redirect(303, "/");
  }

  const rates = await getRates(fetch);

  // Profile page will get accounts data from browser SDK
  // Server no longer provides wallet data
  return { rate: rates[subject.currency] };
}
