import type { PageServerLoad } from './$types';
import updateUser from '$lib/settings';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  return { user };
};

export const actions = {
  default: updateUser,
};
