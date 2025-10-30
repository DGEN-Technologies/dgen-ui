import { g } from "$lib/utils";
// import { g, p } from "$lib/utils"; // p is unused
import { error } from "@sveltejs/kit";

export async function load({ params, fetch }) {
  try {
    const event = await g(`/event/${params.id}/full`, fetch, {});
    return { event };
  } catch (e) {
    console.log(e);
    error(500, { message: "Failed to g event" });
  }
}
