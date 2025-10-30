import { error, json } from "@sveltejs/kit";
import { auth, post } from "$lib/utils";

export async function POST({ cookies, request, fetch }) {
  try {
    const body = await request.json();
    const res = await post("/disable2fa", body, auth(cookies), fetch);

    return json(res);
  } catch (e) {
    error(500, "Problem disabling 2fa");
  }
}
