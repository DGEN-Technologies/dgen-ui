import { auth, post } from "$lib/utils";
import { error, json } from "@sveltejs/kit";

export async function POST({ cookies, request, fetch }) {
  const body = await request.json();
  try {
    const result = await post("/event", body, auth(cookies), fetch);
    return json(result);
  } catch (e: any) {
    error(500, e.message);
  }
}
