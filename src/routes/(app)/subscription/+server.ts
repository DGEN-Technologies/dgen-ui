import { auth, post } from "$lib/utils";
import { json } from "@sveltejs/kit";

export async function POST({ cookies, request, fetch }) {
  const body = await request.json();
  const result = await post("/subscription", body, auth(cookies), fetch);
  return json(result);
}
