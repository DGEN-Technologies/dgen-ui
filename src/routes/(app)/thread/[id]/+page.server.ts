import { g } from "$lib/utils";
import { error } from "@sveltejs/kit";

export async function load({ params, fetch }) {
  try {
    const thread = await g(`/thread/${params.id}`, fetch, {});
    return { thread };
  } catch (e) {
    console.log(e);
    error(500, { message: "Failed to g thread" });
  }
}
