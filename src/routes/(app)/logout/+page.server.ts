import { redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";

// Use secure settings in production, relaxed settings in development
const opts = {
  expires: new Date(0),
  path: "/",
  httpOnly: !dev,  // true in production (prevents JS access)
  secure: !dev,     // true in production (HTTPS only)
  sameSite: (dev ? "lax" : "strict") as const,  // strict in production (CSRF protection)
};

export async function load({ cookies, fetch }) {
  const lang = cookies.get("lang");
  cookies.set("aid", "", opts);
  cookies.set("lang", "", opts);
  cookies.set("username", "", opts);
  cookies.set("token", "", opts);
  cookies.set("pin", "", opts);
  cookies.set("sk", "", opts);
  cookies.set("theme", "", opts);
  cookies.set("sid", "", opts);
  // Use 302 to force full page reload and clear all client state
  throw redirect(302, `/login?lang=${lang}`);
}
