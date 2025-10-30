import { auth, post } from "$lib/utils";
import { json } from "@sveltejs/kit";

export async function POST({ cookies, request, fetch }) {
  const result = await post("/request", await request.json(), auth(cookies), fetch);
  return json(result);
}
