import { env } from "$env/dynamic/public";
import { auth } from "$lib/utils";

export async function POST({ cookies, fetch, params, request }) {
  const { path } = params;
  const base = env.PUBLIC_DGEN_URL || process.env.PUBLIC_DGEN_URL || "";

  return fetch(`${base}/${path}`, {
    method: "POST",
    body: JSON.stringify(await request.json()),
    headers: { "Content-Type": "application/json", ...auth(cookies) },
  });
}
