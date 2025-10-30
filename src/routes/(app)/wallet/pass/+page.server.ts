import { redirect } from '@sveltejs/kit';

export async function load({ parent }) {
  const { user } = await parent();
  
  if (!user) {
    // User not logged in, redirect to login
    redirect(307, '/login?redirect=/wallet/setup');
  }
  
  return {
    user
  };
}