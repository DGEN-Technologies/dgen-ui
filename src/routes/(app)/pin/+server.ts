import { json } from "@sveltejs/kit";
import { auth, post } from "$lib/utils";

export async function POST({ cookies, request, fetch }) {
  const result = await post("/pin", await request.json(), auth(cookies), fetch);
  return json(result);
}
