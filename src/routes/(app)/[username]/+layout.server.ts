import { g } from "$lib/utils";
import { error } from "@sveltejs/kit";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const load = async ({
  cookies,
  depends,
  params: { username },
  parent,
  fetch,
  url,
}) => {
  depends("app:user");

  // Check if this is a post-restoration redirect
  const isRestorationRedirect = url.searchParams.get('restored') === 'true';
  let lastError = null;
  
  // If coming from wallet restoration, try with retries
  if (isRestorationRedirect) {
    const maxRetries = 3;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Wait before retrying (exponential backoff)
        await sleep(1000 * attempt);
      }
      
      try {
        const subject = await g(`/users/${username}`, fetch, {});
        const { user } = await parent();

        const expires = new Date();
        expires.setSeconds(expires.getSeconds() + 380 * 24 * 60 * 60);
        cookies.set("username", username, { path: "/", expires, httpOnly: false });

        return { subject, user, restorationComplete: true };
      } catch (e) {
        lastError = e;
        
        if (attempt === maxRetries) {
          // Final attempt failed, show a more helpful error
          error(503, {
            message: "Your wallet is still syncing. Please refresh the page in a moment.",
            retryable: true,
          });
        }
      }
    }
  }

  // Normal flow without retries
  try {
    const subject = await g(`/users/${username}`, fetch, {});
    const { user } = await parent();

    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + 380 * 24 * 60 * 60);
    cookies.set("username", username, { path: "/", expires, httpOnly: false });

    return { subject, user };
  } catch (e) {
    error(500, "Unable to retrieve user account data");
  }
};
