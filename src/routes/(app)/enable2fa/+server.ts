import { auth, post } from "$lib/utils";

export async function POST({ cookies, request, fetch }) {
  const body = await request.json();
  const res = await post("/2fa", body, auth(cookies), fetch);

  return new Response(JSON.stringify(res));
}
