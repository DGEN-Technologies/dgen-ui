import { redirect } from "@sveltejs/kit";

export const load = async ({ parent, url }) => {
  const { user } = await parent();

  if (!user) {
    // If not logged in, redirect to register
    redirect(307, "/register");
  }

  // Check if wallet is already initialized
  // This will be handled by the client-side component

  return {
    user,
  };
};
