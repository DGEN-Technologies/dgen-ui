import { fd, register } from "$lib/utils";
import { redirect } from "@sveltejs/kit";

export const load = async ({ parent, fetch, url }) => {
  const { user } = await parent();
  if (user) redirect(307, `/${user.username}`);

  const index = Math.floor(Math.random() * 64) + 1;
  
  let challenge;
  try {
    // Use full URL for server-side fetch
    const baseUrl = url.origin;
    const response = await fetch(`${baseUrl}/api/backend/challenge`);
    if (!response.ok) throw new Error(`Challenge fetch failed: ${response.status}`);
    ({ challenge } = await response.json());
  } catch (e) {
    console.error("Challenge fetch error:", e);
    // Generate a random challenge as fallback
    challenge = Math.random().toString(36).substring(2, 15);
  }

  return { index, challenge };
};

export const actions = {
  default: async ({ cookies, request, fetch }) => {
    const ip = request.headers.get("cf-connecting-ip");
    const form = await fd(request);
    const { picture, username, password, confirm } = form;
    let { loginRedirect } = form;
    if (loginRedirect === "undefined") loginRedirect = undefined;

    // Server-side password confirmation validation
    if (password !== confirm) {
      console.log("[Register Action] Password mismatch:", { password, confirm });
      return { status: 400, error: "Passwords don't match" };
    }

    console.log("[Register Action] Starting registration for:", username);
    const user = { picture, username, password };
    const result = await register(user, ip, cookies, loginRedirect, fetch);

    // If registration failed, return the error
    if (result && result.status === 400) {
      console.log("[Register Action] Registration failed with error:", result.error);
      return result;
    }

    console.log("[Register Action] Registration successful, redirecting to profile");
    // Redirect directly to profile - wallet will be auto-generated
    redirect(307, `/${username}`);
  },
};
