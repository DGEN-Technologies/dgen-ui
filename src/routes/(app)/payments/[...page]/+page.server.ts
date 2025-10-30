import { redirect } from "@sveltejs/kit";

const limit = 10;

export async function load({ cookies, params, url }) {
  // Check if user is authenticated
  const token = cookies.get("token");
  if (!token) {
    redirect(307, `/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  const parts = params.page.split("/");

  let start;
  let end;
  let page;
  if (parts.length === 1) [page] = parts;
  if (parts.length === 2) [start, page] = parts;
  if (parts.length === 3) [start, end, page] = parts;
  
  // Parse page number properly
  page = parseInt(page) || 1;
  if (page < 1) page = 1;

  // Browser SDK will handle fetching transactions
  // Just pass pagination params to the client
  return { 
    page, 
    limit,
    start, 
    end
  };
}