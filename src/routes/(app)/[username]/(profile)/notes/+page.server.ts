import { g } from "$lib/utils";
import { error } from "@sveltejs/kit";

export async function load({ parent, fetch }) {
  try {
    const { subject } = await parent();
    const events = await g(`/${subject.pubkey}/events`, fetch, {});
    return { events };
  } catch (e) {
    console.log(e);
    error(500, { message: "Failed to g events" });
  }
}
