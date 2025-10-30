import { redirect, error } from "@sveltejs/kit";

export const load = async ({ cookies, params }) => {
  const { token } = params;

  // Validate token format before setting cookie
  if (!token || typeof token !== 'string') {
    throw error(400, 'Invalid token');
  }

  if (!/^[a-zA-Z0-9\-_]{20,500}$/.test(token)) {
    throw error(400, 'Invalid token format');
  }

  const maxAge = 380 * 24 * 60 * 60;

  const expires = new Date();
  expires.setSeconds(expires.getSeconds() + maxAge);

  const opts = {
    path: "/",
    expires,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true, // Always secure
  };
  cookies.set("token", token, opts);
  redirect(307, "/login");
};
