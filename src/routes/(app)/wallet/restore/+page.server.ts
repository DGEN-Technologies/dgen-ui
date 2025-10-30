import { redirect } from "@sveltejs/kit";

export const load = async ({ parent }) => {
  const { user } = await parent();

  if (!user) {
    // If not logged in, redirect to register
    redirect(307, "/register");
  }

  return {
    user,
  };
};
