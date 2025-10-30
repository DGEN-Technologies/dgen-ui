import { fd, g, login } from "$lib/utils";
import { fail, redirect } from "@sveltejs/kit";

export const load = async ({ parent, fetch, url }) => {
  const { user } = await parent();
  if (user?.pubkey) redirect(307, `/${user.username}`);
  
  let challenge;
  try {
    // Use full URL for server-side fetch
    const baseUrl = url.origin;
    const response = await fetch(`${baseUrl}/api/backend/challenge`);
    ({ challenge } = await response.json());
  } catch (e) {
    console.error("Challenge fetch error:", e);
    challenge = Math.random().toString(36).substring(2, 15);
  }
  
  return { challenge };
};

export const actions = {
  login: async ({ cookies, request, fetch }) => {
    const form = await fd(request);
    let { username, password, token, loginRedirect } = form;
    const user = { username, password, token };

    if (loginRedirect === "undefined") loginRedirect = undefined;

    try {
      await login(user, cookies, request.headers.get("cf-connecting-ip"), fetch);
    } catch (e) {
      const { message } = e as Error;
      return fail(400, { error: "Login failed", message, ...form });
    }

    // Validate redirect to prevent open redirect attacks
    const isValidRedirect = loginRedirect &&
                           /^\/[^/\\].*$/.test(loginRedirect) && // Starts with / but not // or /\
                           !loginRedirect.match(/^[a-z][a-z0-9+.-]*:/i); // No URL scheme
    redirect(307, isValidRedirect ? loginRedirect : `/${user.username}`);
  },

  nostr: async ({ cookies, fetch, request, url }) => {
    const form = await fd(request);
    let { challenge, event, loginRedirect } = form;
    if (loginRedirect === "null") loginRedirect = undefined;
    event = JSON.parse(event);

    const maxAge = 380 * 24 * 60 * 60;

    // Use full URL for server-side fetch
    const baseUrl = url.origin;
    const res = await fetch(`${baseUrl}/api/backend/nostrAuth`, {
      method: "POST",
      body: JSON.stringify({ challenge, event }),
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "cf-connecting-ip": request.headers.get("cf-connecting-ip"),
      },
    });

    if (res.status === 401) {
      const text = await res.text();
      if (text.startsWith("2fa")) throw new Error("2fa");
    }

    const { user, token } = await res.json();
    if (!token) throw new Error("Login failed");
    const { username, language } = user;

    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + maxAge);

    const opts = {
      path: "/",
      expires,
      httpOnly: true,
      sameSite: "lax" as const,
      secure: true, // Always secure in production
    };
    if (language) cookies.set("lang", language, { ...opts, httpOnly: false });
    cookies.set("username", username, { ...opts, httpOnly: false });
    cookies.set("token", token, opts);

    // Validate redirect to prevent open redirect attacks
    const isValidNostrRedirect = loginRedirect &&
                                /^\/[^/\\].*$/.test(loginRedirect) && // Starts with / but not // or /\
                                !loginRedirect.match(/^[a-z][a-z0-9+.-]*:/i); // No URL scheme
    redirect(307, isValidNostrRedirect ? loginRedirect : `/${username}`);
  },
};
